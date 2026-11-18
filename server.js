const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Load Master Data
const boothsMaster = JSON.parse(fs.readFileSync(path.join(__dirname, 'booths_master.json'), 'utf-8'));
const zonesMaster = JSON.parse(fs.readFileSync(path.join(__dirname, 'zones_master.json'), 'utf-8'));
const countingSvc = require('./counting_service');

// Data Store File
const DATA_STORE_PATH = path.join(__dirname, 'election_data_store.json');

let store = {
  config: {
    activeDate: '22-10-2026', // '22-10-2026' or '24-10-2026'
    roName: 'उपखण्ड मजिस्ट्रेट (SDM) सुमेरपुर',
    electionName_22: 'पंचायत समिति एवं जिला परिषद सदस्य आम चुनाव 2026',
    electionName_24: 'सरपंच एवं वार्ड पंच आम चुनाव 2026',
    totalBooths: 152,
    totalVoters: 144905,
    totalGPs: 34,
    totalZones: 10
  },
  users: [
    { username: 'ro_sumerpur', password: 'sdm@2026', role: 'RO', name: 'रिटर्निंग ऑफिसर (SDM)', zone: 'ALL', status: 'ACTIVE' },
    { username: 'admin', password: 'admin123', role: 'RO', name: 'कंट्रोल रूम एडमिन', zone: 'ALL', status: 'ACTIVE' }
  ],
  // Pre-created zone operators
  dates: {
    '22-10-2026': {},
    '24-10-2026': {}
  },
  logs: []
};

// Initialize default zone operators (op_zone1 to op_zone10)
for (let i = 1; i <= 10; i++) {
  store.users.push({
    username: `op_zone${i}`,
    password: 'pass123',
    role: `OP${i}`,
    name: `जोन ${i} ऑपरेटर`,
    zone: `Zone-${i}`,
    status: 'ACTIVE'
  });
}

// Initialize booth structure for both dates
function initBoothsForDate(dateKey) {
  if (!store.dates[dateKey]) store.dates[dateKey] = {};
  boothsMaster.forEach(b => {
    if (!store.dates[dateKey][b.booth_no]) {
      const zNum = b.zone.replace('Zone-', '');
      store.dates[dateKey][b.booth_no] = {
        id: b.booth_no,
        sn: b.sn,
        zone: b.zone,
        zone_name: b.zone_name,
        magistrate: b.zonal_magistrate,
        magistrate_mob: b.magistrate_mobile,
        gp_name: b.gp_name,
        location: b.location,
        name: `${b.gp_name} - ${b.location}`,
        ps_ward: b.ps_ward,
        zp_ward: b.zp_ward,
        electors: b.voters,
        operator_role: `OP${zNum}`,
        praganak_name: b.blo_name || 'बी.एल.ओ.',
        praganak_mob: b.blo_mobile || '',
        mock_done: true,
        started: true,
        v10: '',
        v13: '',
        v15: '',
        v18: '',
        v_queue: '',
        v_final: '',
        remark: 'शांतिपूर्ण'
      };
    }
  });
}

// Load or Save Store
function loadStore() {
  if (fs.existsSync(DATA_STORE_PATH)) {
    try {
      const raw = fs.readFileSync(DATA_STORE_PATH, 'utf-8');
      const loaded = JSON.parse(raw);
      store = { ...store, ...loaded };
    } catch (e) {
      console.error('Error reading store file:', e);
    }
  }
  initBoothsForDate('22-10-2026');
  initBoothsForDate('24-10-2026');
  countingSvc.initCounting(store, boothsMaster);
  saveStore();
}

function saveStore() {
  try {
    fs.writeFileSync(DATA_STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving store:', e);
  }
}

loadStore();

// SSE (Server-Sent Events) Clients
let sseClients = [];
function broadcastUpdate(type = 'UPDATE') {
  const payload = `data: ${JSON.stringify({ type, timestamp: new Date().toISOString() })}\n\n`;
  sseClients.forEach(c => c.res.write(payload));
}

// -------------------------------------------------------------
// API ENDPOINTS
// -------------------------------------------------------------

// 1. GET /api/data (Full Election State)
app.get('/api/data', (req, res) => {
  const dateKey = req.query.date || store.config.activeDate;
  if (!store.dates[dateKey]) initBoothsForDate(dateKey);

  const boothsDict = store.dates[dateKey];
  const boothsList = boothsMaster.map(b => {
    const bd = boothsDict[b.booth_no] || {};
    const electors = b.voters || 0;
    
    // Determine latest votes
    let latest = 0;
    if (bd.v_final !== '' && bd.v_final !== undefined) latest = Number(bd.v_final);
    else if (bd.v18 !== '' && bd.v18 !== undefined) latest = Number(bd.v18);
    else if (bd.v15 !== '' && bd.v15 !== undefined) latest = Number(bd.v15);
    else if (bd.v13 !== '' && bd.v13 !== undefined) latest = Number(bd.v13);
    else if (bd.v10 !== '' && bd.v10 !== undefined) latest = Number(bd.v10);

    const turnoutPct = electors > 0 && latest > 0 ? Number(((latest / electors) * 100).toFixed(2)) : 0;

    return {
      ...bd,
      id: b.booth_no,
      sn: b.sn,
      zone: b.zone,
      zone_name: b.zone_name,
      magistrate: b.zonal_magistrate,
      magistrate_mob: b.magistrate_mobile,
      gp_name: b.gp_name,
      location: b.location,
      name: `${b.gp_name} - ${b.location}`,
      ps_ward: b.ps_ward,
      zp_ward: b.zp_ward,
      electors: electors,
      latestVotes: latest,
      turnoutPct: turnoutPct
    };
  });

  // Calculate KPIs
  let totalElectors = 0;
  let mockCount = 0;
  let startedCount = 0;
  let totalVotes = 0;
  let slotSums = { v10: 0, v13: 0, v15: 0, v18: 0, v_queue: 0, v_final: 0 };

  boothsList.forEach(b => {
    totalElectors += b.electors;
    if (b.mock_done) mockCount++;
    if (b.started) startedCount++;
    totalVotes += b.latestVotes;

    if (b.v10 !== '') slotSums.v10 += Number(b.v10) || 0;
    if (b.v13 !== '') slotSums.v13 += Number(b.v13) || 0;
    if (b.v15 !== '') slotSums.v15 += Number(b.v15) || 0;
    if (b.v18 !== '') slotSums.v18 += Number(b.v18) || 0;
    if (b.v_queue !== '') slotSums.v_queue += Number(b.v_queue) || 0;
    if (b.v_final !== '') slotSums.v_final += Number(b.v_final) || 0;
  });

  const overallTurnout = totalElectors > 0 ? Number(((totalVotes / totalElectors) * 100).toFixed(2)) : 0;

  // Zone Summary
  const zonesSummary = zonesMaster.map(z => {
    const zBooths = boothsList.filter(b => b.zone === z.zone_id);
    let zElectors = 0;
    let zVotes = 0;
    let zMock = 0;
    let zStarted = 0;
    zBooths.forEach(b => {
      zElectors += b.electors;
      zVotes += b.latestVotes;
      if (b.mock_done) zMock++;
      if (b.started) zStarted++;
    });
    return {
      ...z,
      electors: zElectors,
      votes: zVotes,
      turnoutPct: zElectors > 0 ? Number(((zVotes / zElectors) * 100).toFixed(2)) : 0,
      mock_done: zMock,
      started: zStarted
    };
  });

  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    config: {
      ...store.config,
      selectedDate: dateKey
    },
    kpi: {
      totalElectors,
      mockDone: mockCount,
      started: startedCount,
      totalVotes,
      turnoutPct: overallTurnout,
      slots: {
        s10: { count: slotSums.v10, pct: totalElectors > 0 ? Number(((slotSums.v10 / totalElectors) * 100).toFixed(2)) : 0 },
        s13: { count: slotSums.v13, pct: totalElectors > 0 ? Number(((slotSums.v13 / totalElectors) * 100).toFixed(2)) : 0 },
        s15: { count: slotSums.v15, pct: totalElectors > 0 ? Number(((slotSums.v15 / totalElectors) * 100).toFixed(2)) : 0 },
        s18: { count: slotSums.v18, pct: totalElectors > 0 ? Number(((slotSums.v18 / totalElectors) * 100).toFixed(2)) : 0 },
        queue: { count: slotSums.v_queue },
        final: { count: slotSums.v_final, pct: totalElectors > 0 ? Number(((slotSums.v_final / totalElectors) * 100).toFixed(2)) : 0 }
      }
    },
    zones: zonesSummary,
    booths: boothsList,
    logs: store.logs.slice(-20)
  });
});

// 2. POST /api/booth/:id (Update Booth)
app.post('/api/booth/:id', (req, res) => {
  const boothId = req.params.id;
  const dateKey = req.body.date || store.config.activeDate;
  if (!store.dates[dateKey]) initBoothsForDate(dateKey);

  if (!store.dates[dateKey][boothId]) {
    return res.status(404).json({ success: false, message: 'Booth not found' });
  }

  const allowedFields = ['mock_done', 'started', 'v10', 'v13', 'v15', 'v18', 'v_queue', 'v_final', 'remark', 'praganak_name', 'praganak_mob'];
  allowedFields.forEach(f => {
    if (req.body[f] !== undefined) {
      store.dates[dateKey][boothId][f] = req.body[f];
    }
  });

  store.dates[dateKey][boothId].updated_at = new Date().toISOString();
  store.dates[dateKey][boothId].updated_by = req.body.updated_by || 'Operator';

  store.logs.push({
    time: new Date().toLocaleTimeString('en-IN'),
    booth: boothId,
    user: req.body.updated_by || 'Operator',
    action: `बूथ ${boothId} डेटा अद्यतन`
  });

  saveStore();
  broadcastUpdate('BOOTH_UPDATE');
  res.json({ success: true, message: `Booth ${boothId} updated successfully` });
});

// 3. POST /api/booths/bulk (Bulk Update)
app.post('/api/booths/bulk', (req, res) => {
  const dateKey = req.body.date || store.config.activeDate;
  const updates = req.body.updates || []; // array of { id, ...fields }
  if (!store.dates[dateKey]) initBoothsForDate(dateKey);

  updates.forEach(u => {
    if (store.dates[dateKey][u.id]) {
      Object.assign(store.dates[dateKey][u.id], u);
      store.dates[dateKey][u.id].updated_at = new Date().toISOString();
    }
  });

  saveStore();
  broadcastUpdate('BULK_UPDATE');
  res.json({ success: true, count: updates.length });
});

// -------------------------------------------------------------
// GOOGLE SHEET AUTO-SYNC ENGINE
// -------------------------------------------------------------
const DEFAULT_SHEET_ID = '1akpSIbiSWMT5XahHoZnCZiCS_yFrBThkoI_Ltys2tGY';
const DEFAULT_GID = '1529625107';

function parseCSV(text) {
  const lines = [];
  let row = [];
  let inQuotes = false;
  let field = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push(field.trim());
      field = '';
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') i++;
      row.push(field.trim());
      field = '';
      if (row.length > 0 && row.some(x => x !== '')) {
        lines.push(row);
      }
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field.trim());
    lines.push(row);
  }
  return lines;
}

function processAndApplySheetRows(rows, dateKey = '22-10-2026') {
  if (!store.dates[dateKey]) initBoothsForDate(dateKey);

  // 1. Detect the actual table header row (skipping banner/title rows with < 5 non-empty cells)
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const filled = rows[i].filter(x => x && String(x).trim().length > 0);
    if (filled.length < 5) continue; // Skip title banner rows
    const r = rows[i].map(x => String(x || '').toLowerCase());
    if (r.some(x => x.includes('बूथ') || x.includes('booth')) &&
        r.some(x => x.includes('मतदाता') || x.includes('voter') || x.includes('मत') || x.includes('zone') || x.includes('ज़ोन'))) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) headerRowIdx = 1;
  const header = rows[headerRowIdx].map(x => String(x || '').toLowerCase());

  // 2. Identify Column Indices
  let colBooth = header.findIndex(x => x.includes('बूथ नं') || x.includes('बूथ सं') || x === 'बूथ' || x === 'booth' || x === 'booth_no');
  if (colBooth === -1) colBooth = header.findIndex(x => x.includes('बूथ'));
  if (colBooth === -1) colBooth = 4;

  // 10 AM, 1 PM, 3 PM, 6 PM, Final (make sure not to match '%')
  let col10 = header.findIndex(x => (x.includes('10') && (x.includes('am') || x.includes('मत') || x.includes('बजे'))) && !x.includes('%'));
  if (col10 === -1) col10 = 11;

  let col13 = header.findIndex(x => (x.includes('1') && !x.includes('10') && (x.includes('pm') || x.includes('मत') || x.includes('बजे') || x.includes('13'))) && !x.includes('%'));
  if (col13 === -1) col13 = 13;

  let col15 = header.findIndex(x => ((x.includes('3') && !x.includes('13')) && (x.includes('pm') || x.includes('मत') || x.includes('बजे') || x.includes('15'))) && !x.includes('%'));
  if (col15 === -1) col15 = 15;

  let col18 = header.findIndex(x => (x.includes('6') && (x.includes('pm') || x.includes('मत') || x.includes('बजे') || x.includes('18'))) && !x.includes('%'));
  if (col18 === -1) col18 = 17;

  let colFin = header.findIndex(x => (x.includes('final') || x.includes('अंतिम मत') || (x.includes('अंतिम') && !x.includes('%'))));
  if (colFin === -1) colFin = 19;

  let colRem = header.findIndex(x => x.includes('टिप्पणी') || x.includes('remark'));
  if (colRem === -1) colRem = 21;

  const cleanInt = (val) => {
    if (val === undefined || val === null) return '';
    let s = String(val).replace(/,/g, '').trim();
    if (s === '' || s === '-' || s === 'null') return '';
    const n = parseInt(s, 10);
    return isNaN(n) ? '' : n;
  };

  const updatedBooths = [];
  const stats = { v10: 0, v13: 0, v15: 0, v18: 0, v_final: 0 };

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length <= colBooth) continue;
    // Skip column numbering index row (e.g. 1, 2, 3, 4, 5...)
    if (row[0] === '1' && row[1] === '2' && row[2] === '3') continue;

    let bNo = String(row[colBooth] || '').trim();
    if (!bNo || bNo.includes('कुल') || bNo.includes('total')) continue;
    if (bNo.endsWith('.0')) bNo = bNo.slice(0, -2);

    if (store.dates[dateKey][bNo]) {
      const bObj = store.dates[dateKey][bNo];
      const val10 = cleanInt(row[col10]);
      const val13 = cleanInt(row[col13]);
      const val15 = cleanInt(row[col15]);
      const val18 = cleanInt(row[col18]);
      const valFin = cleanInt(row[colFin]);
      const rem = row[colRem] !== undefined ? String(row[colRem]).trim() : '';

      if (val10 !== '') { bObj.v10 = val10; stats.v10++; }
      if (val13 !== '') { bObj.v13 = val13; stats.v13++; }
      if (val15 !== '') { bObj.v15 = val15; stats.v15++; }
      if (val18 !== '') { bObj.v18 = val18; stats.v18++; }
      if (valFin !== '') { bObj.v_final = valFin; stats.v_final++; }
      if (rem) bObj.remark = rem;
      bObj.started = true;
      bObj.mock_done = true;
      bObj.updated_at = new Date().toISOString();
      bObj.updated_by = 'GoogleSheetSync';

      updatedBooths.push(bNo);
    }
  }

  saveStore();
  broadcastUpdate('BULK_UPDATE');
  return { updatedCount: updatedBooths.length, stats };
}

async function fetchAndSyncGoogleSheet(sheetId = DEFAULT_SHEET_ID, gid = DEFAULT_GID, dateKey = store.config.activeDate) {
  const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  try {
    const resp = await fetch(exportUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    if (resp.status === 401 || resp.status === 403) {
      return {
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Google Sheet शेयरिंग परमिशन Restricted है। कृपया Google Sheet में ऊपर दाईं ओर नीला Share बटन दबाएं और General access में "Anyone with the link" (Viewer) चुनें।'
      };
    }

    if (!resp.ok) {
      return {
        success: false,
        error: `HTTP_${resp.status}`,
        message: `Google Sheet फ़ेच विफल: HTTP ${resp.status}`
      };
    }

    const csvText = await resp.text();
    if (!csvText || csvText.length < 50) {
      return { success: false, message: 'Google Sheet से प्राप्त डेटा खाली है।' };
    }

    const parsedRows = parseCSV(csvText);
    const result = processAndApplySheetRows(parsedRows, dateKey);

    return {
      success: true,
      message: `Google Sheet से ${result.updatedCount} बूथों का डेटा (10 AM, 1 PM, 3 PM, 6 PM, Final) सफलतापूर्वक ऑटो-फ़िल हुआ!`,
      ...result
    };
  } catch (err) {
    return { success: false, error: err.message, message: 'Google Sheet से कनेक्ट करने में त्रुटि: ' + err.message };
  }
}

// Sync Endpoints
app.get('/api/sync-google-sheet', async (req, res) => {
  const sheetId = req.query.sheetId || DEFAULT_SHEET_ID;
  const gid = req.query.gid || DEFAULT_GID;
  const dateKey = req.query.date || store.config.activeDate;
  const result = await fetchAndSyncGoogleSheet(sheetId, gid, dateKey);
  res.json(result);
});

app.post('/api/sync-google-sheet', async (req, res) => {
  const sheetId = req.body.sheetId || DEFAULT_SHEET_ID;
  const gid = req.body.gid || DEFAULT_GID;
  const dateKey = req.body.date || store.config.activeDate;
  const result = await fetchAndSyncGoogleSheet(sheetId, gid, dateKey);
  res.json(result);
});

app.post('/api/sync-csv-data', (req, res) => {
  const { csvText, dateKey } = req.body;
  if (!csvText) return res.status(400).json({ success: false, message: 'csvText required' });
  const rows = parseCSV(csvText);
  const result = processAndApplySheetRows(rows, dateKey || store.config.activeDate);
  res.json({
    success: true,
    message: `फाइल से ${result.updatedCount} बूथों का डेटा सफलतापूर्वक सिंक किया गया!`,
    ...result
  });
});


// 4. SSE Stream (/api/live-stream)
app.get('/api/live-stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const clientId = Date.now();
  const newClient = { id: clientId, res };
  sseClients.push(newClient);

  req.on('close', () => {
    sseClients = sseClients.filter(c => c.id !== clientId);
  });
});

// 5. Auth: Login & Register
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const u = store.users.find(x => x.username.toLowerCase() === (username || '').toLowerCase() && x.password === password);
  if (!u) {
    return res.status(401).json({ success: false, message: 'यूज़रनेम या पासवर्ड गलत है।' });
  }
  if (u.status !== 'ACTIVE') {
    return res.status(403).json({ success: false, message: 'आपका खाता अभी निष्क्रिय / अनुमोदन हेतु लंबित है।' });
  }
  res.json({
    success: true,
    user: {
      username: u.username,
      name: u.name,
      role: u.role,
      zone: u.zone
    }
  });
});

app.post('/api/register', (req, res) => {
  const { name, mobile, designation, role, username, password } = req.body;
  if (!username || !password || !name) {
    return res.status(400).json({ success: false, message: 'कृपया समस्त अनिवार्य विवरण भरें।' });
  }

  const exists = store.users.find(x => x.username.toLowerCase() === username.toLowerCase());
  if (exists) {
    return res.status(400).json({ success: false, message: 'यह यूज़रनेम पूर्व से पंजीकृत है।' });
  }

  const zNum = role.replace('OP', '');
  const newUser = {
    username,
    password,
    role,
    name,
    mobile: mobile || '',
    designation: designation || '',
    zone: `Zone-${zNum}`,
    status: 'ACTIVE'
  };

  store.users.push(newUser);
  saveStore();

  res.json({
    success: true,
    message: 'पंजीयन सफल! अब आप लॉगिन कर सकते हैं।',
    user: { username: newUser.username, name: newUser.name, role: newUser.role, zone: newUser.zone }
  });
});

// 6. Admin: Seed Mock Rehearsal Data
app.post('/api/admin/seed-demo', (req, res) => {
  const dateKey = req.body.date || store.config.activeDate;
  if (!store.dates[dateKey]) initBoothsForDate(dateKey);

  boothsMaster.forEach(b => {
    const p10 = 0.12 + Math.random() * 0.08;
    const p13 = 0.32 + Math.random() * 0.12;
    const p15 = 0.50 + Math.random() * 0.12;
    const p18 = 0.68 + Math.random() * 0.14;
    const pFin = Math.min(p18 + 0.02 + Math.random() * 0.04, 0.94);

    store.dates[dateKey][b.booth_no] = {
      ...store.dates[dateKey][b.booth_no],
      mock_done: true,
      started: true,
      v10: Math.round(b.voters * p10),
      v13: Math.round(b.voters * p13),
      v15: Math.round(b.voters * p15),
      v18: Math.round(b.voters * p18),
      v_queue: Math.floor(Math.random() * 8),
      v_final: Math.round(b.voters * pFin),
      remark: 'शांतिपूर्ण'
    };
  });

  saveStore();
  broadcastUpdate('SEED_DEMO');
  res.json({ success: true, message: `152 बूथों पर डेमो डेटा सफलतापूर्वक भरा गया (${dateKey})` });
});

// 7. Admin: Reset
app.post('/api/admin/reset', (req, res) => {
  const dateKey = req.body.date || store.config.activeDate;
  store.dates[dateKey] = {};
  initBoothsForDate(dateKey);
  saveStore();
  broadcastUpdate('RESET');
  res.json({ success: true, message: `दिनांक ${dateKey} का समस्त डेटा रीसेट कर दिया गया।` });
});

// 8. Admin: Set Active Date
app.post('/api/admin/set-date', (req, res) => {
  const { date } = req.body;
  if (date === '22-10-2026' || date === '24-10-2026') {
    store.config.activeDate = date;
    saveStore();
    broadcastUpdate('DATE_CHANGE');
    res.json({ success: true, activeDate: date });
  } else {
    res.status(400).json({ success: false, message: 'Invalid date' });
  }
});

// 9. Export CSV
app.get('/api/export/csv', (req, res) => {
  const dateKey = req.query.date || store.config.activeDate;
  const booths = store.dates[dateKey] || {};

  let csv = 'बूथ सं.,ज़ोन,ग्राम पंचायत,मतदान केंद्र स्थल,पं.स. वार्ड,जि.प. वार्ड,कुल मतदाता,मॉक पोल,7:15 प्रारंभ,10 AM,01 PM,03 PM,06 PM,6 PM कतार,Final,अंतिम %,ज़ोनल मजिस्ट्रेट,मोबाइल\n';
  boothsMaster.forEach(b => {
    const d = booths[b.booth_no] || {};
    const electors = b.voters || 0;
    const finalV = d.v_final !== '' && d.v_final !== undefined ? d.v_final : d.v18 || 0;
    const pct = electors > 0 ? ((finalV / electors) * 100).toFixed(2) : '0.00';
    csv += `"${b.booth_no}","${b.zone}","${b.gp_name}","${b.location.replace(/"/g, '""')}","${b.ps_ward}","${b.zp_ward}",${electors},"${d.mock_done ? 'हाँ' : 'नहीं'}","${d.started ? 'हाँ' : 'नहीं'}",${d.v10 || 0},${d.v13 || 0},${d.v15 || 0},${d.v18 || 0},${d.v_queue || 0},${finalV},"${pct}%","${b.zonal_magistrate}","${b.magistrate_mobile}"\n`;
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=Sumerpur_Panchayat_Poll_Progress_${dateKey}.csv`);
  res.send('\uFEFF' + csv);
});

// -------------------------------------------------------------
// COUNTING MODULE APIS (14 ROUNDS x 15 TABLES)
// -------------------------------------------------------------

// 10. GET /api/counting (Full Counting State & Live Aggregations)
app.get('/api/counting', (req, res) => {
  countingSvc.initCounting(store, boothsMaster);
  const data = countingSvc.computeCountingStats(store.counting, boothsMaster, store);
  res.json({ success: true, ...data });
});

// 11. POST /api/counting/slot (Update votes for a single slot - Unified PS and ZP)
app.post('/api/counting/slot', (req, res) => {
  const { 
    s_no, round, table, booth_no, 
    votes, zp_votes,
    c1, c2, c3, c4, c5, cand1, cand2, cand3, nota,
    zp_c1, zp_c2, zp_c3, zp_c4, zp_nota,
    status, remark 
  } = req.body;

  countingSvc.initCounting(store, boothsMaster);
  const slots = store.counting.slots || {};

  let targetSlot = null;
  if (s_no && slots[String(s_no)]) {
    targetSlot = slots[String(s_no)];
  } else if (booth_no) {
    targetSlot = Object.values(slots).find(s => String(s.booth_no).trim() === String(booth_no).trim());
  } else if (round && table) {
    targetSlot = Object.values(slots).find(s => Number(s.round) === Number(round) && Number(s.table) === Number(table));
  }

  if (!targetSlot) {
    return res.status(404).json({ success: false, message: 'Slot not found for given s_no / booth / round & table' });
  }

  // 1. Process Panchayat Samiti Votes
  const vObj = (votes && typeof votes === 'object') ? votes : {};
  const v1 = Number(vObj.c1 !== undefined ? vObj.c1 : (c1 !== undefined ? c1 : cand1)) || 0;
  const v2 = Number(vObj.c2 !== undefined ? vObj.c2 : (c2 !== undefined ? c2 : cand2)) || 0;
  const v3 = Number(vObj.c3 !== undefined ? vObj.c3 : (c3 !== undefined ? c3 : cand3)) || 0;
  const v4 = Number(vObj.c4 !== undefined ? vObj.c4 : c4) || 0;
  const v5 = Number(vObj.c5 !== undefined ? vObj.c5 : c5) || 0;
  const nt = Number(vObj.nota !== undefined ? vObj.nota : nota) || 0;
  const psTot = v1 + v2 + v3 + v4 + v5 + nt;

  targetSlot.votes = { c1: v1, c2: v2, c3: v3, c4: v4, c5: v5, nota: nt, total: psTot };

  // 2. Process Zila Parishad Votes (CU is the same)
  const zvObj = (zp_votes && typeof zp_votes === 'object') ? zp_votes : {};
  const zv1 = Number(zvObj.c1 !== undefined ? zvObj.c1 : zp_c1) || 0;
  const zv2 = Number(zvObj.c2 !== undefined ? zvObj.c2 : zp_c2) || 0;
  const zv3 = Number(zvObj.c3 !== undefined ? zvObj.c3 : zp_c3) || 0;
  const zv4 = Number(zvObj.c4 !== undefined ? zvObj.c4 : zp_c4) || 0;
  const znt = Number(zvObj.nota !== undefined ? zvObj.nota : zp_nota) || 0;
  const zpTot = zv1 + zv2 + zv3 + zv4 + znt;

  targetSlot.zp_votes = { c1: zv1, c2: zv2, c3: zv3, c4: zv4, nota: znt, total: zpTot };

  // Status & Remark
  if (status) {
    targetSlot.status = status;
  } else if (psTot > 0 || zpTot > 0) {
    targetSlot.status = 'COMPLETED';
  } else {
    targetSlot.status = 'PENDING';
  }
  if (remark !== undefined) targetSlot.remark = remark;

  saveStore();
  broadcastUpdate('COUNTING_UPDATE');
  const data = countingSvc.computeCountingStats(store.counting, boothsMaster, store);
  res.json({ 
    success: true, 
    message: `बूथ ${targetSlot.booth_no} (CU: ${targetSlot.cu_id}) के पं.स. व जि.प. दोनों मत सुरक्षित किए गए।`, 
    slot: targetSlot, 
    ...data 
  });
});

// 12. POST /api/counting/bulk-slots (Bulk update counting slots)
app.post('/api/counting/bulk-slots', (req, res) => {
  const { updates } = req.body;
  if (!Array.isArray(updates)) return res.status(400).json({ success: false, message: 'updates array required' });

  countingSvc.initCounting(store, boothsMaster);
  const slots = store.counting.slots || {};

  updates.forEach(u => {
    let s = null;
    if (u.s_no && slots[String(u.s_no)]) {
      s = slots[String(u.s_no)];
    } else if (u.booth_no) {
      s = Object.values(slots).find(x => String(x.booth_no).trim() === String(u.booth_no).trim());
    } else if (u.round && u.table) {
      s = Object.values(slots).find(x => Number(x.round) === Number(u.round) && Number(x.table) === Number(u.table));
    }

    if (s) {
      if (u.votes || u.cand1 !== undefined || u.c1 !== undefined) {
        const vObj = u.votes || {};
        const c1 = Number(vObj.c1 !== undefined ? vObj.c1 : (u.c1 !== undefined ? u.c1 : u.cand1)) || 0;
        const c2 = Number(vObj.c2 !== undefined ? vObj.c2 : (u.c2 !== undefined ? u.c2 : u.cand2)) || 0;
        const c3 = Number(vObj.c3 !== undefined ? vObj.c3 : (u.c3 !== undefined ? u.c3 : u.cand3)) || 0;
        const c4 = Number(vObj.c4 !== undefined ? vObj.c4 : u.c4) || 0;
        const c5 = Number(vObj.c5 !== undefined ? vObj.c5 : u.c5) || 0;
        const nt = Number(vObj.nota !== undefined ? vObj.nota : u.nota) || 0;
        s.votes = { c1, c2, c3, c4, c5, nota: nt, total: c1 + c2 + c3 + c4 + c5 + nt };
      }
      if (u.zp_votes || u.zp_c1 !== undefined) {
        const zvObj = u.zp_votes || {};
        const zc1 = Number(zvObj.c1 !== undefined ? zvObj.c1 : u.zp_c1) || 0;
        const zc2 = Number(zvObj.c2 !== undefined ? zvObj.c2 : u.zp_c2) || 0;
        const zc3 = Number(zvObj.c3 !== undefined ? zvObj.c3 : u.zp_c3) || 0;
        const zc4 = Number(zvObj.c4 !== undefined ? zvObj.c4 : u.zp_c4) || 0;
        const znt = Number(zvObj.nota !== undefined ? zvObj.nota : u.zp_nota) || 0;
        s.zp_votes = { c1: zc1, c2: zc2, c3: zc3, c4: zc4, nota: znt, total: zc1 + zc2 + zc3 + zc4 + znt };
      }
      if (u.status) s.status = u.status;
      else if ((s.votes && s.votes.total > 0) || (s.zp_votes && s.zp_votes.total > 0)) s.status = 'COMPLETED';
      if (u.remark !== undefined) s.remark = u.remark;
    }
  });

  saveStore();
  broadcastUpdate('COUNTING_UPDATE');
  const data = countingSvc.computeCountingStats(store.counting, boothsMaster, store);
  res.json({ success: true, updatedCount: updates.length, ...data });
});

// 13. POST /api/counting/config (Save Sheet ID, GID, Active Round)
app.post('/api/counting/config', (req, res) => {
  countingSvc.initCounting(store, boothsMaster);
  const { sheetId, gid, activeRound } = req.body;
  if (sheetId) store.counting.config.sheetId = String(sheetId).trim();
  if (gid !== undefined) store.counting.config.gid = String(gid).trim();
  if (activeRound) store.counting.config.activeRound = Number(activeRound);

  saveStore();
  res.json({ success: true, config: store.counting.config });
});

// 13b. POST /api/counting/mock-test (Execute Mock Test Simulation or Reset)
app.post('/api/counting/mock-test', (req, res) => {
  const { action } = req.body;
  countingSvc.initCounting(store, boothsMaster);

  const simRes = countingSvc.runMockSimulation(store.counting, action || 'load_round_1');
  saveStore();
  broadcastUpdate('COUNTING_UPDATE');
  const data = countingSvc.computeCountingStats(store.counting, boothsMaster, store);
  res.json({ success: true, ...simRes, ...data });
});

// 14. Google Sheet Auto-Sync for Counting
async function fetchAndSyncCountingGoogleSheet(sheetId, gid) {
  countingSvc.initCounting(store, boothsMaster);
  const sId = sheetId || store.counting.config.sheetId || DEFAULT_SHEET_ID;
  const gId = gid || store.counting.config.gid || '0';
  const exportUrl = `https://docs.google.com/spreadsheets/d/${sId}/export?format=csv&gid=${gId}`;

  try {
    const resp = await fetch(exportUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });

    if (resp.status === 401 || resp.status === 403) {
      return {
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Google Sheet शेयरिंग परमिशन Restricted है। कृपया Google Sheet में ऊपर दाईं ओर नीला Share बटन दबाएं और General access में "Anyone with the link" (Viewer) चुनें।'
      };
    }

    if (!resp.ok) {
      return {
        success: false,
        error: `HTTP_${resp.status}`,
        message: `Google Sheet फ़ेच विफल: HTTP ${resp.status}`
      };
    }

    const csvText = await resp.text();
    if (!csvText || csvText.length < 20) {
      return { success: false, message: 'Google Sheet से प्राप्त मतगणना डेटा खाली है।' };
    }

    const rows = countingSvc.parseCSV(csvText);
    const result = countingSvc.processCountingSheetRows(rows, store.counting, boothsMaster);
    if (result.success) {
      saveStore();
      broadcastUpdate('COUNTING_UPDATE');
    }
    const computed = countingSvc.computeCountingStats(store.counting, boothsMaster);
    return { ...result, ...computed };
  } catch (err) {
    return { success: false, error: err.message, message: 'Google Sheet से कनेक्ट करने में त्रुटि: ' + err.message };
  }
}

app.get('/api/counting/sync-google-sheet', async (req, res) => {
  const { sheetId, gid } = req.query;
  const result = await fetchAndSyncCountingGoogleSheet(sheetId, gid);
  res.json(result);
});

app.post('/api/counting/sync-google-sheet', async (req, res) => {
  const { sheetId, gid } = req.body;
  const result = await fetchAndSyncCountingGoogleSheet(sheetId, gid);
  res.json(result);
});

// 15. POST /api/counting/sync-csv (Upload CSV directly)
app.post('/api/counting/sync-csv', (req, res) => {
  const { csvText } = req.body;
  if (!csvText) return res.status(400).json({ success: false, message: 'csvText required' });

  countingSvc.initCounting(store, boothsMaster);
  const rows = countingSvc.parseCSV(csvText);
  const result = countingSvc.processCountingSheetRows(rows, store.counting, boothsMaster);
  if (result.success) {
    saveStore();
    broadcastUpdate('COUNTING_UPDATE');
  }
  const computed = countingSvc.computeCountingStats(store.counting, boothsMaster);
  res.json({ ...result, ...computed });
});

// 16. GET /api/counting/template-csv (Download Sample Template CSV for Google Sheet)
app.get('/api/counting/template-csv', (req, res) => {
  countingSvc.initCounting(store, boothsMaster);
  const csv = countingSvc.generateTemplateCSV(store.counting);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=Sumerpur_PS_Counting_Template_14R_15T.csv');
  res.send('\uFEFF' + csv);
});

// 17. GET /api/counting/export-csv (Export Current Counting Results)
app.get('/api/counting/export-csv', (req, res) => {
  countingSvc.initCounting(store, boothsMaster);
  const stats = countingSvc.computeCountingStats(store.counting, boothsMaster, store);
  const slots = store.counting.slots || {};

  let csv = 'S.NO.,ROUND NO.,TABLE NO.,BOOTH NO.,CU ID,GP NAME,LOCATION,PS WARD,ZP WARD,EVM POLLED (17C),PS COUNTED,ZP COUNTED,STATUS,PS LEADER,PS MARGIN,ZP LEADER,ZP MARGIN,REMARKS\n';

  const list = Object.values(slots).sort((a, b) => Number(a.s_no) - Number(b.s_no));
  list.forEach(s => {
    const v = s.votes || {};
    const zv = s.zp_votes || {};
    const psTot = Number(v.total) || 0;
    const zpTot = Number(zv.total) || 0;
    const polled = Number(s.polled_votes) || 0;

    const pw = (stats.ps_wards && stats.ps_wards[s.ps_ward]) || {};
    const zw = (stats.zp_wards && stats.zp_wards[s.zp_ward]) || {};

    const psLead = (pw.leader && pw.leader.name !== '-') ? `${pw.leader.name} [${pw.leader.party}]` : '';
    const zpLead = (zw.leader && zw.leader.name !== '-') ? `${zw.leader.name} [${zw.leader.party}]` : '';

    csv += `${s.s_no},${s.round},${s.table},"${s.booth_no}","${s.cu_id || ''}","${s.gp_name || ''}","${(s.location || '').replace(/"/g, '""')}",` +
           `"${s.ps_ward || ''}","${s.zp_ward || ''}",${polled},${psTot},${zpTot},"${s.status || 'PENDING'}",` +
           `"${psLead}",${pw.margin || 0},"${zpLead}",${zw.margin || 0},"${(s.remark || '').replace(/"/g, '""')}"\n`;
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=Sumerpur_PS_Counting_Results_Live.csv');
  res.send('\uFEFF' + csv);
});

// Dedicated Counting Page
app.get('/counting', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'counting.html'));
});

// Fallback to SPA index.html
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🏛️ सुमेरपुर पंचायती राज चुनाव 2026 - पोल प्रोग्रेस सर्वर`);
  console.log(`🌐 Server running at: http://localhost:${PORT}`);
  console.log(`📅 Active Dates: 22-10-2026 (PS & ZP) | 24-10-2026 (Sarpanch)`);
  console.log(`=======================================================`);
});
