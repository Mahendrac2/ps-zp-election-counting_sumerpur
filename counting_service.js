// counting_service.js - Sumerpur Counting System based on Official DEO Pali Counting Plan
// 152 Polling Stations x 14 Rounds x 15 Tables x CU IDs x 21 PS Wards x 4 ZP Wards

const fs = require('fs');
const path = require('path');

const TOTAL_ROUNDS = 14;
const TOTAL_TABLES = 15;
const TOTAL_WARDS_PS = 21;
const TOTAL_WARDS_ZP = 4;
const TOTAL_BOOTHS = 152;

// Load Counting Plan Master (Official DEO Pali)

// Initialize empty postal ballots structure
function createInitialPostalBallots() {
  const pb = { ps: {}, zp: {} };
  for (let w = 1; w <= TOTAL_WARDS_PS; w++) {
    const wKey = `W-${w}`;
    pb.ps[wKey] = {
      ward: wKey,
      c1: 0, c2: 0, c3: 0, c4: 0, c5: 0,
      nota: 0,
      rejected: 0,
      total_valid: 0,
      total_received: 0,
      status: 'PENDING',
      remark: '',
      updated_at: null
    };
  }
  ['Z-7', 'Z-8', 'Z-9', 'Z-10'].forEach(zKey => {
    pb.zp[zKey] = {
      ward: zKey,
      c1: 0, c2: 0, c3: 0, c4: 0,
      nota: 0,
      rejected: 0,
      total_valid: 0,
      total_received: 0,
      status: 'PENDING',
      remark: '',
      updated_at: null
    };
  });
  return pb;
}

// Load Official 152 Booths Counting Plan Master
function loadPlanMaster() {
  const p = path.join(__dirname, 'counting_plan_master.json');
  if (fs.existsSync(p)) {
    try {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch (e) {
      console.error('Error reading counting_plan_master.json:', e);
    }
  }
  return [];
}

// Load Candidates Master
function loadCandidatesMaster() {
  const p = path.join(__dirname, 'candidates_master.json');
  if (fs.existsSync(p)) {
    try {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch (e) {
      console.error('Error reading candidates_master.json:', e);
    }
  }
  return { ps: {}, zp: {} };
}

// Generate slots based on Official DEO Pali Plan
function generatePlanSlots(boothsMaster, store) {
  const plan = loadPlanMaster();
  const d22 = (store && store.dates && store.dates['22-10-2026']) ? store.dates['22-10-2026'] : {};
  const bMap = {};
  boothsMaster.forEach(b => bMap[String(b.booth_no).trim()] = b);

  const slots = {};

  plan.forEach(p => {
    const bNo = String(p.booth_no).trim();
    const b = bMap[bNo] || {};
    const polled = d22[bNo] ? (Number(d22[bNo].v_final) || Number(d22[bNo].v18) || 0) : 0;

    const slotKey = String(p.s_no);
    slots[slotKey] = {
      s_no: p.s_no,
      round: p.round,
      table: p.table,
      booth_no: bNo,
      cu_id: p.cu_id || '',
      ps_ward: p.ps_ward,
      zp_ward: p.zp_ward,
      gp_name: b.gp_name || '',
      location: b.location || '',
      electors: b.voters || 0,
      polled_votes: polled, // Official EVM Polled Votes
      votes: {
        c1: 0,
        c2: 0,
        c3: 0,
        c4: 0,
        c5: 0,
        nota: 0,
        total: 0
      },
      zp_votes: {
        c1: 0,
        c2: 0,
        c3: 0,
        nota: 0,
        total: 0
      },
      status: 'PENDING',
      remark: p.remarks || ''
    };
  });

  return slots;
}

// Initialize Counting Store
function initCounting(store, boothsMaster) {
  if (!store.counting) {
    store.counting = {};
  }
  if (!store.counting.postal_ballots) {
    store.counting.postal_ballots = createInitialPostalBallots();
  }
  const candMaster = loadCandidatesMaster();

  if (!store.counting) {
    store.counting = {
      config: {
        totalRounds: TOTAL_ROUNDS,
        totalTables: TOTAL_TABLES,
        totalWardsPS: TOTAL_WARDS_PS,
        totalWardsZP: TOTAL_WARDS_ZP,
        totalBooths: TOTAL_BOOTHS,
        activeRound: 1,
        sheetId: '1akpSIbiSWMT5XahHoZnCZiCS_yFrBThkoI_Ltys2tGY',
        gid: '0',
        lastSyncTime: null
      },
      candidates: candMaster.ps,
      zp_candidates: candMaster.zp,
      slots: generatePlanSlots(boothsMaster, store)
    };
  } else {
    store.counting.candidates = candMaster.ps;
    store.counting.zp_candidates = candMaster.zp;

    // Check if slots exist and match official plan
    const plan = loadPlanMaster();
    if (!store.counting.slots || Object.keys(store.counting.slots).length !== 152 || !store.counting.slots['1']?.cu_id) {
      // Migrate / Initialize with official plan, preserving any existing votes by booth_no
      const existingVotes = {};
      if (store.counting.slots) {
        Object.values(store.counting.slots).forEach(s => {
          if (s.booth_no && (s.votes?.total > 0 || s.status === 'COMPLETED')) {
            existingVotes[s.booth_no] = { votes: s.votes, zp_votes: s.zp_votes, status: s.status, remark: s.remark };
          }
        });
      }

      store.counting.slots = generatePlanSlots(boothsMaster, store);

      // Restore votes
      Object.values(store.counting.slots).forEach(s => {
        if (existingVotes[s.booth_no]) {
          s.votes = existingVotes[s.booth_no].votes || s.votes;
          s.zp_votes = existingVotes[s.booth_no].zp_votes || s.zp_votes;
          s.status = existingVotes[s.booth_no].status || s.status;
          s.remark = existingVotes[s.booth_no].remark || s.remark;
        }
      });
    } else {
      // Sync polled votes from store dates
      const d22 = (store && store.dates && store.dates['22-10-2026']) ? store.dates['22-10-2026'] : {};
      Object.values(store.counting.slots).forEach(slot => {
        if (slot.booth_no && d22[slot.booth_no]) {
          slot.polled_votes = Number(d22[slot.booth_no].v_final) || Number(d22[slot.booth_no].v18) || slot.polled_votes || 0;
        }
      });
    }
  }
  return store.counting;
}

// Compute Aggregated Statistics
function computeCountingStats(counting, boothsMaster, store) {
  const slots = counting.slots || {};
  const psCandidates = counting.candidates || {};
  const zpCandidates = counting.zp_candidates || {};

  // 1. PS Ward Map (21 Wards)
  const psWardMap = {};
  for (let w = 1; w <= TOTAL_WARDS_PS; w++) {
    const wKey = `W-${w}`;
    const candList = psCandidates[wKey] || [
      { key: 'c1', name: 'प्रत्याशी 1 (भाजपा)', party: 'BJP', symbol: 'कमल' },
      { key: 'c2', name: 'प्रत्याशी 2 (कांग्रेस)', party: 'INC', symbol: 'हाथ' }
    ];

    psWardMap[wKey] = {
      ward: wKey,
      wardNo: w,
      totalBooths: 0,
      completedBooths: 0,
      totalElectors: 0,
      totalPolledVotes: 0,
      totalCountedVotes: 0,
      candVotes: { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, nota: 0 },
      candidates: candList,
      leader: null,
      runnerUp: null,
      margin: 0,
      status: 'PENDING',
      booths: []
    };
  }

  // 2. ZP Ward Map (4 Wards)
  const zpWardMap = {};
  ['Z-7', 'Z-8', 'Z-9', 'Z-10'].forEach(zKey => {
    const info = zpCandidates[zKey] || {};
    zpWardMap[zKey] = {
      ward: zKey,
      wardNo: info.wardNo || parseInt(zKey.replace('Z-', ''), 10),
      totalBooths: 0,
      completedBooths: 0,
      totalElectors: 0,
      totalPolledVotes: info.polled || 0,
      totalCountedVotes: 0,
      candVotes: { c1: 0, c2: 0, c3: 0, c4: 0, nota: 0 },
      candidates: info.candidates || [],
      leader: null,
      runnerUp: null,
      margin: 0,
      status: 'PENDING',
      booths: []
    };
  });

  // Assign booth slots to PS and ZP maps
  Object.values(slots).forEach(slot => {
    // PS
    if (slot.ps_ward && psWardMap[slot.ps_ward]) {
      const pwm = psWardMap[slot.ps_ward];
      pwm.totalBooths++;
      pwm.totalElectors += (slot.electors || 0);
      pwm.totalPolledVotes += (slot.polled_votes || 0);
      pwm.booths.push(slot);

      const v = slot.votes || {};
      const c1 = Number(v.c1) || 0;
      const c2 = Number(v.c2) || 0;
      const c3 = Number(v.c3) || 0;
      const c4 = Number(v.c4) || 0;
      const c5 = Number(v.c5) || 0;
      const nota = Number(v.nota) || 0;
      const tot = c1 + c2 + c3 + c4 + c5 + nota;

      if (slot.status === 'COMPLETED' || tot > 0) {
        pwm.completedBooths++;
        pwm.totalCountedVotes += tot;
        pwm.candVotes.c1 += c1;
        pwm.candVotes.c2 += c2;
        pwm.candVotes.c3 += c3;
        pwm.candVotes.c4 += c4;
        pwm.candVotes.c5 += c5;
        pwm.candVotes.nota += nota;

        // Compute booth-level leader for PS
        const psCands = pwm.candidates || [];
        let psMax = -1, psLead = null, psSecond = 0;
        psCands.forEach(c => {
          const cv = Number(v[c.key]) || 0;
          if (cv > psMax) {
            psSecond = psMax >= 0 ? psMax : 0;
            psMax = cv;
            psLead = { name: c.name, party: c.party || 'IND', votes: cv };
          } else if (cv > psSecond) {
            psSecond = cv;
          }
        });
        slot.ps_leader = (psMax > 0 && psLead) ? { ...psLead, margin: psMax - psSecond } : null;
      } else {
        slot.ps_leader = null;
      }
    }

    // ZP
    if (slot.zp_ward && zpWardMap[slot.zp_ward]) {
      const zwm = zpWardMap[slot.zp_ward];
      zwm.totalBooths++;
      zwm.totalElectors += (slot.electors || 0);
      zwm.booths.push(slot);

      const zv = slot.zp_votes || {};
      const zc1 = Number(zv.c1) || 0;
      const zc2 = Number(zv.c2) || 0;
      const zc3 = Number(zv.c3) || 0;
      const zc4 = Number(zv.c4) || 0;
      const znota = Number(zv.nota) || 0;
      const ztot = zc1 + zc2 + zc3 + zc4 + znota;

      if (slot.status === 'COMPLETED' || ztot > 0) {
        zwm.completedBooths++;
        zwm.totalCountedVotes += ztot;
        zwm.candVotes.c1 += zc1;
        zwm.candVotes.c2 += zc2;
        zwm.candVotes.c3 += zc3;
        if (zwm.candVotes.c4 !== undefined) zwm.candVotes.c4 += zc4;
        zwm.candVotes.nota += znota;

        // Compute booth-level leader for ZP
        const zpCands = zwm.candidates || [];
        let zpMax = -1, zpLead = null, zpSecond = 0;
        zpCands.forEach(c => {
          const cv = Number(zv[c.key]) || 0;
          if (cv > zpMax) {
            zpSecond = zpMax >= 0 ? zpMax : 0;
            zpMax = cv;
            zpLead = { name: c.name, party: c.party || 'IND', votes: cv };
          } else if (cv > zpSecond) {
            zpSecond = cv;
          }
        });
        slot.zp_leader = (zpMax > 0 && zpLead) ? { ...zpLead, margin: zpMax - zpSecond } : null;
      } else {
        slot.zp_leader = null;
      }
    }
  });


  // Integrate Postal Ballots (डाक मतपत्र) into PS and ZP Ward Totals
  const postalBallots = (store && store.counting && store.counting.postal_ballots) || counting.postal_ballots || createInitialPostalBallots();

  // 1b. Merge Postal Ballots into PS Wards
  Object.values(psWardMap).forEach(pwm => {
    // Preserve EVM booth counted votes
    pwm.evmCountedVotes = pwm.totalCountedVotes;
    pwm.evmCandVotes = { ...pwm.candVotes };

    const pb = (postalBallots.ps && postalBallots.ps[pwm.ward]) || {
      ward: pwm.ward, c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, nota: 0, rejected: 0, total_valid: 0, total_received: 0, status: 'PENDING'
    };
    const c1 = Number(pb.c1) || 0;
    const c2 = Number(pb.c2) || 0;
    const c3 = Number(pb.c3) || 0;
    const c4 = Number(pb.c4) || 0;
    const c5 = Number(pb.c5) || 0;
    const nota = Number(pb.nota) || 0;
    const rej = Number(pb.rejected) || 0;
    const valid = c1 + c2 + c3 + c4 + c5 + nota;
    const rec = (pb.total_received !== undefined && Number(pb.total_received) > 0) ? Number(pb.total_received) : (valid + rej);

    pwm.postalBallots = {
      ...pb,
      c1, c2, c3, c4, c5, nota, rejected: rej,
      total_valid: valid,
      total_received: rec,
      status: (rec > 0) ? 'COMPLETED' : 'PENDING'
    };
    pwm.postalCandVotes = { c1, c2, c3, c4, c5, nota };
    pwm.postalCountedVotes = valid;

    // Combined Official Total: EVM Votes + Postal Ballot Votes
    pwm.candVotes.c1 += c1;
    pwm.candVotes.c2 += c2;
    pwm.candVotes.c3 += c3;
    pwm.candVotes.c4 += c4;
    pwm.candVotes.c5 += c5;
    pwm.candVotes.nota += nota;
    pwm.totalCountedVotes += valid;
  });

  // 2b. Merge Postal Ballots into ZP Wards
  Object.values(zpWardMap).forEach(zwm => {
    // Preserve EVM booth counted votes
    zwm.evmCountedVotes = zwm.totalCountedVotes;
    zwm.evmCandVotes = { ...zwm.candVotes };

    const pb = (postalBallots.zp && postalBallots.zp[zwm.ward]) || {
      ward: zwm.ward, c1: 0, c2: 0, c3: 0, c4: 0, nota: 0, rejected: 0, total_valid: 0, total_received: 0, status: 'PENDING'
    };
    const c1 = Number(pb.c1) || 0;
    const c2 = Number(pb.c2) || 0;
    const c3 = Number(pb.c3) || 0;
    const c4 = Number(pb.c4) || 0;
    const nota = Number(pb.nota) || 0;
    const rej = Number(pb.rejected) || 0;
    const valid = c1 + c2 + c3 + c4 + nota;
    const rec = (pb.total_received !== undefined && Number(pb.total_received) > 0) ? Number(pb.total_received) : (valid + rej);

    zwm.postalBallots = {
      ...pb,
      c1, c2, c3, c4, nota, rejected: rej,
      total_valid: valid,
      total_received: rec,
      status: (rec > 0) ? 'COMPLETED' : 'PENDING'
    };
    zwm.postalCandVotes = { c1, c2, c3, c4, nota };
    zwm.postalCountedVotes = valid;

    // Combined Official Total: EVM Votes + Postal Ballot Votes
    zwm.candVotes.c1 += c1;
    zwm.candVotes.c2 += c2;
    zwm.candVotes.c3 += c3;
    if (zwm.candVotes.c4 !== undefined) zwm.candVotes.c4 += c4;
    zwm.candVotes.nota += nota;
    zwm.totalCountedVotes += valid;
  });

  // Calculate PS Party Tallies, Leads & Declared Status
  const psPartyTally = {
    BJP: { won: 0, lead: 0, total: 0 },
    INC: { won: 0, lead: 0, total: 0 },
    IND: { won: 0, lead: 0, total: 0 }
  };
  let psDeclaredCount = 0;
  let psInProgressCount = 0;

  Object.values(psWardMap).forEach(pwm => {
    const ranked = pwm.candidates.map(c => ({
      key: c.key,
      name: c.name,
      party: c.party || 'IND',
      symbol: c.symbol || '',
      votes: pwm.candVotes[c.key] || 0
    })).sort((a, b) => b.votes - a.votes);

    if (pwm.completedBooths > 0 && pwm.totalCountedVotes > 0) {
      pwm.leader = ranked[0];
      pwm.runnerUp = ranked[1] || { name: '-', votes: 0 };
      pwm.margin = ranked[0].votes - (ranked[1]?.votes || 0);

      if (pwm.completedBooths >= pwm.totalBooths && pwm.totalBooths > 0) {
        pwm.status = 'DECLARED';
        psDeclaredCount++;
        if (psPartyTally[ranked[0].party]) {
          psPartyTally[ranked[0].party].won++;
          psPartyTally[ranked[0].party].total++;
        }
      } else {
        pwm.status = 'COUNTING';
        psInProgressCount++;
        if (psPartyTally[ranked[0].party]) {
          psPartyTally[ranked[0].party].lead++;
          psPartyTally[ranked[0].party].total++;
        }
      }
    } else {
      pwm.status = 'PENDING';
      pwm.leader = ranked[0];
      pwm.runnerUp = ranked[1];
      pwm.margin = 0;
    }
  });

  // Calculate ZP Party Tallies & Leads
  const zpPartyTally = {
    BJP: { won: 0, lead: 0, total: 0 },
    INC: { won: 0, lead: 0, total: 0 },
    IND: { won: 0, lead: 0, total: 0 }
  };
  let zpDeclaredCount = 0;

  Object.values(zpWardMap).forEach(zwm => {
    const ranked = zwm.candidates.map(c => ({
      key: c.key,
      name: c.name,
      party: c.party || 'IND',
      symbol: c.symbol || '',
      votes: zwm.candVotes[c.key] || 0
    })).sort((a, b) => b.votes - a.votes);

    if (zwm.completedBooths > 0 && zwm.totalCountedVotes > 0) {
      zwm.leader = ranked[0];
      zwm.runnerUp = ranked[1] || { name: '-', votes: 0 };
      zwm.margin = ranked[0].votes - (ranked[1]?.votes || 0);

      if (zwm.completedBooths >= zwm.totalBooths && zwm.totalBooths > 0) {
        zwm.status = 'DECLARED';
        zpDeclaredCount++;
        if (zpPartyTally[ranked[0].party]) {
          zpPartyTally[ranked[0].party].won++;
          zpPartyTally[ranked[0].party].total++;
        }
      } else {
        zwm.status = 'COUNTING';
        if (zpPartyTally[ranked[0].party]) {
          zpPartyTally[ranked[0].party].lead++;
          zpPartyTally[ranked[0].party].total++;
        }
      }
    } else {
      zwm.status = 'PENDING';
      zwm.leader = ranked[0];
      zwm.runnerUp = ranked[1];
      zwm.margin = 0;
    }
  });

  // 3. Round-wise statistics (14 Rounds)
  const roundStats = {};
  let totalCountedVotes = 0;
  let totalCompletedBooths = 0;

  for (let r = 1; r <= TOTAL_ROUNDS; r++) {
    roundStats[r] = {
      round: r,
      totalBoothsInRound: 0,
      completedBoothsInRound: 0,
      totalPolledVotes: 0,
      totalVotes: 0,
      status: 'PENDING',
      slots: []
    };
  }

  // Group slots by round
  Object.values(slots).forEach(s => {
    const r = s.round;
    if (roundStats[r]) {
      roundStats[r].totalBoothsInRound++;
      roundStats[r].totalPolledVotes += (s.polled_votes || 0);
      roundStats[r].slots.push(s);

      const vTot = Number(s.votes ? s.votes.total : 0) || 0;
      if (s.status === 'COMPLETED' || vTot > 0) {
        roundStats[r].completedBoothsInRound++;
        roundStats[r].totalVotes += vTot;
        totalCountedVotes += vTot;
        totalCompletedBooths++;
      }
    }
  });

  // Sort slots inside each round by table number
  for (let r = 1; r <= TOTAL_ROUNDS; r++) {
    const rs = roundStats[r];
    rs.slots.sort((a, b) => a.table - b.table || a.s_no - b.s_no);

    if (rs.completedBoothsInRound === rs.totalBoothsInRound && rs.totalBoothsInRound > 0) {
      rs.status = 'COMPLETED';
    } else if (rs.completedBoothsInRound > 0) {
      rs.status = 'COUNTING';
    } else {
      rs.status = 'PENDING';
    }
  }

  // Active Round detection
  let activeRound = 1;
  let allRoundsCompleted = true;
  for (let r = 1; r <= TOTAL_ROUNDS; r++) {
    if (roundStats[r].status === 'COUNTING') { 
      activeRound = r; 
      allRoundsCompleted = false;
      break; 
    } else if (roundStats[r].status === 'PENDING') { 
      activeRound = r; 
      allRoundsCompleted = false;
      break; 
    }
  }
  if (allRoundsCompleted && totalCompletedBooths > 0) {
    activeRound = TOTAL_ROUNDS; // All 14 rounds completed
  }

  return {
    config: counting.config || {},
    kpi: {
      totalRounds: TOTAL_ROUNDS,
      totalTables: TOTAL_TABLES,
      totalWardsPS: TOTAL_WARDS_PS,
      totalWardsZP: TOTAL_WARDS_ZP,
      totalBooths: TOTAL_BOOTHS,
      activeRound,
      isAllCompleted: allRoundsCompleted && totalCompletedBooths > 0,
      totalPolledVotes: 71943,
      totalCountedVotes,
      totalCompletedBooths,
      progressPct: TOTAL_BOOTHS > 0 ? ((totalCompletedBooths / TOTAL_BOOTHS) * 100).toFixed(1) : '0.0',
      declaredWardsPS: psDeclaredCount,
      inProgressWardsPS: psInProgressCount,
      pendingWardsPS: TOTAL_WARDS_PS - psDeclaredCount - psInProgressCount,
      declaredWardsZP: zpDeclaredCount,
      psPartyTally,
      zpPartyTally,
      postalKPI: (() => {
        let psRec = 0, psVal = 0, psRej = 0, psComp = 0;
        Object.values(psWardMap).forEach(pwm => {
          if (pwm.postalBallots && pwm.postalBallots.status === 'COMPLETED') psComp++;
          psRec += (pwm.postalBallots?.total_received || 0);
          psVal += (pwm.postalBallots?.total_valid || 0);
          psRej += (pwm.postalBallots?.rejected || 0);
        });
        let zpRec = 0, zpVal = 0, zpRej = 0, zpComp = 0;
        Object.values(zpWardMap).forEach(zwm => {
          if (zwm.postalBallots && zwm.postalBallots.status === 'COMPLETED') zpComp++;
          zpRec += (zwm.postalBallots?.total_received || 0);
          zpVal += (zwm.postalBallots?.total_valid || 0);
          zpRej += (zwm.postalBallots?.rejected || 0);
        });
        return {
          totalReceived: psRec + zpRec,
          totalValid: psVal + zpVal,
          totalRejected: psRej + zpRej,
          completedWards: psComp + zpComp,
          totalWards: TOTAL_WARDS_PS + TOTAL_WARDS_ZP,
          ps: { received: psRec, valid: psVal, rejected: psRej, completed: psComp },
          zp: { received: zpRec, valid: zpVal, rejected: zpRej, completed: zpComp }
        };
      })()
    },
    postal_ballots: postalBallots,
    candidates: psCandidates,
    zp_candidates: zpCandidates,
    ps_wards: psWardMap,
    zp_wards: zpWardMap,
    rounds: roundStats,
    slots
  };
}

// Clean CSV parser
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  const rows = [];
  for (let line of lines) {
    const row = [];
    let insideQuote = false;
    let entry = '';
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (insideQuote && line[i + 1] === '"') { entry += '"'; i++; }
        else insideQuote = !insideQuote;
      } else if (c === ',' && !insideQuote) {
        row.push(entry.trim());
        entry = '';
      } else {
        entry += c;
      }
    }
    row.push(entry.trim());
    rows.push(row);
  }
  return rows;
}

// Process and Apply Google Sheet rows
function processCountingSheetRows(rows, counting, boothsMaster) {
  if (!rows || rows.length < 2) return { success: false, message: 'डेटा पंक्तियां अपर्याप्त हैं।' };

  let headerRowIdx = -1;
  let colSNo = -1, colRound = -1, colTable = -1, colBooth = -1, colCUID = -1, colRemark = -1;
  let colPsC1 = -1, colPsC2 = -1, colPsC3 = -1, colPsC4 = -1, colPsC5 = -1, colPsNota = -1, colPsTotal = -1;
  let colZpC1 = -1, colZpC2 = -1, colZpC3 = -1, colZpC4 = -1, colZpNota = -1, colZpTotal = -1;

  for (let r = 0; r < Math.min(rows.length, 5); r++) {
    const row = rows[r].map(c => c.toLowerCase().trim());
    row.forEach((cell, idx) => {
      if (cell.includes('s.no') || cell.includes('s_no') || cell === 'क्र.सं.') colSNo = idx;
      else if (cell.includes('round') || cell.includes('राउंड') || cell === 'r') colRound = idx;
      else if (cell.includes('table') || cell.includes('टेबल') || cell.includes('मेज') || cell === 't') colTable = idx;
      else if (cell.includes('booth') || cell.includes('बूथ') || cell === 'b') colBooth = idx;
      else if (cell.includes('cu') || cell.includes('सी.यू.')) colCUID = idx;
      else if (cell.includes('remark') || cell.includes('टिप्पणी')) colRemark = idx;
      
      // ZP Columns (Check for zp / जि.प prefix or context)
      else if (cell.includes('zp') || cell.includes('जि.प') || cell.includes('जिला परिषद')) {
        if (cell.includes('c1') || cell.includes('cand1') || cell.includes('प्रत्याशी 1')) colZpC1 = idx;
        else if (cell.includes('c2') || cell.includes('cand2') || cell.includes('प्रत्याशी 2')) colZpC2 = idx;
        else if (cell.includes('c3') || cell.includes('cand3') || cell.includes('प्रत्याशी 3')) colZpC3 = idx;
        else if (cell.includes('c4') || cell.includes('cand4') || cell.includes('प्रत्याशी 4')) colZpC4 = idx;
        else if (cell.includes('nota') || cell.includes('नोटा')) colZpNota = idx;
        else if (cell.includes('total') || cell.includes('counted') || cell.includes('कुल') || cell.includes('गिने')) colZpTotal = idx;
      }
      
      // PS Columns (Check for ps / पं.स prefix or context)
      else if (cell.includes('ps') || cell.includes('पं.स') || cell.includes('पंचायत समिति')) {
        if (cell.includes('c1') || cell.includes('cand1') || cell.includes('प्रत्याशी 1')) colPsC1 = idx;
        else if (cell.includes('c2') || cell.includes('cand2') || cell.includes('प्रत्याशी 2')) colPsC2 = idx;
        else if (cell.includes('c3') || cell.includes('cand3') || cell.includes('प्रत्याशी 3')) colPsC3 = idx;
        else if (cell.includes('c4') || cell.includes('cand4') || cell.includes('प्रत्याशी 4')) colPsC4 = idx;
        else if (cell.includes('c5') || cell.includes('cand5') || cell.includes('प्रत्याशी 5')) colPsC5 = idx;
        else if (cell.includes('nota') || cell.includes('नोटा')) colPsNota = idx;
        else if (cell.includes('total') || cell.includes('counted') || cell.includes('कुल') || cell.includes('गिने')) colPsTotal = idx;
      }
      // Fallback generic candidate columns (if no prefix)
      else if (cell.includes('c1') || cell.includes('cand1') || cell.includes('प्रत्याशी 1')) {
        if (colPsC1 === -1) colPsC1 = idx;
        else if (colZpC1 === -1) colZpC1 = idx;
      }
      else if (cell.includes('c2') || cell.includes('cand2') || cell.includes('प्रत्याशी 2')) {
        if (colPsC2 === -1) colPsC2 = idx;
        else if (colZpC2 === -1) colZpC2 = idx;
      }
      else if (cell.includes('c3') || cell.includes('cand3') || cell.includes('प्रत्याशी 3')) {
        if (colPsC3 === -1) colPsC3 = idx;
        else if (colZpC3 === -1) colZpC3 = idx;
      }
      else if (cell.includes('c4') || cell.includes('cand4') || cell.includes('प्रत्याशी 4')) {
        if (colPsC4 === -1) colPsC4 = idx;
        else if (colZpC4 === -1) colZpC4 = idx;
      }
      else if (cell.includes('c5') || cell.includes('cand5') || cell.includes('प्रत्याशी 5')) {
        if (colPsC5 === -1) colPsC5 = idx;
      }
      else if (cell.includes('nota') || cell.includes('नोटा')) {
        if (colPsNota === -1) colPsNota = idx;
        else if (colZpNota === -1) colZpNota = idx;
      }
      else if (cell.includes('total') || cell.includes('counted') || cell.includes('कुल') || cell.includes('योग')) {
        if (colPsTotal === -1) colPsTotal = idx;
        else if (colZpTotal === -1) colZpTotal = idx;
      }
    });

    if ((colRound !== -1 && colTable !== -1) || colSNo !== -1 || colBooth !== -1) {
      headerRowIdx = r;
      break;
    }
  }

  if (headerRowIdx === -1) headerRowIdx = 0;

  let updatedCount = 0;
  const cleanNum = v => {
    if (v === undefined || v === null || v === '') return 0;
    const n = parseInt(String(v).replace(/[^0-9]/g, ''), 10);
    return isNaN(n) ? 0 : n;
  };

  const slots = counting.slots || {};
  const sNoMap = {};
  const boothMap = {};
  Object.values(slots).forEach(s => {
    if (s.s_no) sNoMap[s.s_no] = s;
    if (s.booth_no) boothMap[String(s.booth_no).trim()] = s;
  });

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    let targetSlot = null;

    if (colSNo !== -1 && row[colSNo]) {
      const sNum = cleanNum(row[colSNo]);
      if (sNoMap[sNum]) targetSlot = sNoMap[sNum];
    }

    if (!targetSlot && colBooth !== -1 && row[colBooth]) {
      let bVal = String(row[colBooth]).trim();
      if (bVal.endsWith('.0')) bVal = bVal.slice(0, -2);
      if (boothMap[bVal]) targetSlot = boothMap[bVal];
    }

    if (!targetSlot && colRound !== -1 && colTable !== -1 && row[colRound] && row[colTable]) {
      const rNum = cleanNum(row[colRound]);
      const tNum = cleanNum(row[colTable]);
      targetSlot = Object.values(slots).find(s => s.round === rNum && s.table === tNum);
    }

    if (targetSlot) {
      // PS Votes
      const c1 = colPsC1 !== -1 ? cleanNum(row[colPsC1]) : targetSlot.votes.c1;
      const c2 = colPsC2 !== -1 ? cleanNum(row[colPsC2]) : targetSlot.votes.c2;
      const c3 = colPsC3 !== -1 ? cleanNum(row[colPsC3]) : targetSlot.votes.c3;
      const c4 = colPsC4 !== -1 ? cleanNum(row[colPsC4]) : targetSlot.votes.c4;
      const c5 = colPsC5 !== -1 ? cleanNum(row[colPsC5]) : targetSlot.votes.c5;
      const nota = colPsNota !== -1 ? cleanNum(row[colPsNota]) : targetSlot.votes.nota;
      let psTot = c1 + c2 + c3 + c4 + c5 + nota;
      if (psTot === 0 && colPsTotal !== -1) psTot = cleanNum(row[colPsTotal]);

      targetSlot.votes = { c1, c2, c3, c4, c5, nota, total: psTot };

      // ZP Votes
      const zc1 = colZpC1 !== -1 ? cleanNum(row[colZpC1]) : targetSlot.zp_votes.c1;
      const zc2 = colZpC2 !== -1 ? cleanNum(row[colZpC2]) : targetSlot.zp_votes.c2;
      const zc3 = colZpC3 !== -1 ? cleanNum(row[colZpC3]) : targetSlot.zp_votes.c3;
      const zc4 = colZpC4 !== -1 ? cleanNum(row[colZpC4]) : targetSlot.zp_votes.c4;
      const znota = colZpNota !== -1 ? cleanNum(row[colZpNota]) : targetSlot.zp_votes.nota;
      let zpTot = zc1 + zc2 + zc3 + zc4 + znota;
      if (zpTot === 0 && colZpTotal !== -1) zpTot = cleanNum(row[colZpTotal]);

      targetSlot.zp_votes = { c1: zc1, c2: zc2, c3: zc3, c4: zc4, nota: znota, total: zpTot };

      if (psTot > 0 || zpTot > 0) targetSlot.status = 'COMPLETED';
      if (colRemark !== -1 && row[colRemark]) targetSlot.remark = String(row[colRemark]).trim();
      updatedCount++;
    }
  }

  counting.config.lastSyncTime = new Date().toISOString();
  return {
    success: true,
    updatedCount,
    message: `Google Sheet से ${updatedCount} टेबल प्रविष्टियां सफलतापूर्वक सिंक की गईं!`
  };
}

// Generate Template CSV matching Official DEO Pali Plan
function generateTemplateCSV(counting) {
  const slots = counting.slots || {};
  let csv = 'S.NO.,POLLING STATION NO.,CU ID (ENTER),ROUND NO.,COUNTING TABLE NO.,PS WARD NO.,ZP WARD NO.,GP NAME,EVM POLLED VOTES,CANDIDATE 1,CANDIDATE 2,CANDIDATE 3,CANDIDATE 4,CANDIDATE 5,NOTA,TOTAL COUNTED,STATUS,REMARKS\n';

  const list = Object.values(slots).sort((a, b) => a.s_no - b.s_no);
  list.forEach(s => {
    const v = s.votes || {};
    csv += `${s.s_no},"${s.booth_no}","${s.cu_id || ''}",${s.round},${s.table},"${s.ps_ward}","${s.zp_ward}","${s.gp_name}",${s.polled_votes || 0},${v.c1 || 0},${v.c2 || 0},${v.c3 || 0},${v.c4 || 0},${v.c5 || 0},${v.nota || 0},${v.total || 0},"${s.status || 'PENDING'}","${s.remark || ''}"\n`;
  });

  return csv;
}

// Mock Test Data Simulation Helper
function distributeMockVotes(polled, candCount) {
  if (polled <= 0) return { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, nota: 0, total: 0 };
  const nota = Math.max(1, Math.round(polled * 0.015));
  let remaining = polled - nota;
  const res = { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, nota, total: polled };

  if (candCount <= 2) {
    const c1 = Math.round(remaining * (0.47 + (Math.random() * 0.08)));
    const c2 = remaining - c1;
    res.c1 = c1;
    res.c2 = c2;
  } else if (candCount === 3) {
    const c1 = Math.round(remaining * 0.44);
    const c2 = Math.round(remaining * 0.38);
    const c3 = remaining - c1 - c2;
    res.c1 = c1; res.c2 = c2; res.c3 = c3;
  } else if (candCount === 4) {
    const c1 = Math.round(remaining * 0.38);
    const c2 = Math.round(remaining * 0.32);
    const c3 = Math.round(remaining * 0.18);
    const c4 = remaining - c1 - c2 - c3;
    res.c1 = c1; res.c2 = c2; res.c3 = c3; res.c4 = c4;
  } else {
    const c1 = Math.round(remaining * 0.35);
    const c2 = Math.round(remaining * 0.30);
    const c3 = Math.round(remaining * 0.18);
    const c4 = Math.round(remaining * 0.10);
    const c5 = remaining - c1 - c2 - c3 - c4;
    res.c1 = c1; res.c2 = c2; res.c3 = c3; res.c4 = c4; res.c5 = c5;
  }
  return res;
}

function runMockSimulation(counting, action) {
  const slots = counting.slots || {};
  const psCandidates = counting.candidates || {};
  const zpCandidates = counting.zp_candidates || {};

  if (action === 'reset_postal_ballots') {
    counting.postal_ballots = { ps: {}, zp: {} };
    return { success: true, message: 'समस्त 21 पं.स. एवं 4 जि.प. वार्डों के डाक मतपत्र (Postal Ballots) का डेटा सफलतापूर्वक रीसेट (शून्य) कर दिया गया है।' };
  }

  if (action === 'reset_all') {
    Object.values(slots).forEach(s => {
      s.votes = { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, nota: 0, total: 0 };
      s.zp_votes = { c1: 0, c2: 0, c3: 0, c4: 0, nota: 0, total: 0 };
      s.status = 'PENDING';
      s.remark = '';
    });
    counting.postal_ballots = { ps: {}, zp: {} };
    return { success: true, message: 'समस्त 152 मतदान केंद्रों का EVM डेटा एवं सभी डाक मतपत्र (Postal Ballots) सफलतापूर्वक रीसेट (शून्य) कर दिए गए हैं।' };
  }

  let targetRounds = [1];
  if (action === 'load_rounds_1_to_3') targetRounds = [1, 2, 3];
  else if (action === 'load_full') targetRounds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

  // If loading a specific round stage, reset non-target rounds so active round progresses naturally
  if (action === 'load_round_1' || action === 'load_rounds_1_to_3') {
    Object.values(slots).forEach(s => {
      if (!targetRounds.includes(s.round)) {
        s.votes = { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, nota: 0, total: 0 };
        s.zp_votes = { c1: 0, c2: 0, c3: 0, c4: 0, nota: 0, total: 0 };
        s.status = 'PENDING';
        s.remark = '';
      }
    });
  }

  let simulatedCount = 0;
  Object.values(slots).forEach(s => {
    if (targetRounds.includes(s.round)) {
      const polled = Number(s.polled_votes) > 0 ? Number(s.polled_votes) : (Math.round((Number(s.electors) || 800) * 0.52) || 450);
      
      // PS candidates
      const psList = (psCandidates[s.ps_ward] || []);
      const psCandCount = Math.max(2, psList.length);
      s.votes = distributeMockVotes(polled, psCandCount);

      // ZP candidates
      const zpList = (zpCandidates[s.zp_ward]?.candidates || []);
      const zpCandCount = Math.max(2, zpList.length);
      s.zp_votes = distributeMockVotes(polled, zpCandCount);

      s.status = 'COMPLETED';
      s.remark = 'मॉक टेस्ट प्रविष्टि (17C EVM सत्यापित)';
      simulatedCount++;
    }
  });

  return { 
    success: true, 
    simulatedCount, 
    action,
    message: `${simulatedCount} मतदान केंद्रों में मॉक टेस्ट डेटा (पं.स. व जि.प.) सफलतापूर्वक दर्ज किया गया!` 
  };
}

module.exports = {
  TOTAL_ROUNDS,
  TOTAL_TABLES,
  TOTAL_WARDS_PS,
  TOTAL_WARDS_ZP,
  TOTAL_BOOTHS,
  initCounting,
  computeCountingStats,
  parseCSV,
  processCountingSheetRows,
  generateTemplateCSV,
  runMockSimulation
};
