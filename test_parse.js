const fs = require('fs');

const text = fs.readFileSync('test_sheet_data.csv', 'utf-8');

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

const rows = parseCSV(text);
console.log('Total rows parsed:', rows.length);

// Robust header detection:
// A true header row must have multiple filled columns (> 4) and specifically contain column headers like 'बूथ' and ('मत' or 'voter' or 'मतदाता' or 'am' or 'pm')
let headerRowIdx = -1;
for (let i = 0; i < Math.min(10, rows.length); i++) {
  const filledCols = rows[i].filter(x => x && x.trim().length > 0);
  if (filledCols.length < 5) continue; // Skip title banner rows!
  const r = rows[i].map(x => String(x || '').toLowerCase());
  if (r.some(x => x.includes('बूथ') || x.includes('booth')) &&
      r.some(x => x.includes('मतदाता') || x.includes('voter') || x.includes('मत') || x.includes('zone') || x.includes('ज़ोन'))) {
    headerRowIdx = i;
    break;
  }
}

console.log('True headerRowIdx:', headerRowIdx);
const header = rows[headerRowIdx].map(x => String(x || '').toLowerCase());
console.log('header columns:', header);

// Find exact columns:
let colBooth = header.findIndex(x => x.includes('बूथ नं') || x.includes('बूथ सं') || x === 'बूथ' || x === 'booth' || x === 'booth_no');
if (colBooth === -1) colBooth = header.findIndex(x => x.includes('बूथ'));

// 10 AM, 1 PM, 3 PM, 6 PM, Final
let col10 = header.findIndex(x => (x.includes('10') && (x.includes('am') || x.includes('मत') || x.includes('बजे'))) && !x.includes('%'));
let col13 = header.findIndex(x => (x.includes('1') && !x.includes('10') && (x.includes('pm') || x.includes('मत') || x.includes('बजे') || x.includes('13'))) && !x.includes('%'));
let col15 = header.findIndex(x => ((x.includes('3') && !x.includes('13')) && (x.includes('pm') || x.includes('मत') || x.includes('बजे') || x.includes('15'))) && !x.includes('%'));
let col18 = header.findIndex(x => (x.includes('6') && (x.includes('pm') || x.includes('मत') || x.includes('बजे') || x.includes('18'))) && !x.includes('%'));
let colFin = header.findIndex(x => (x.includes('final') || x.includes('अंतिम मत') || (x.includes('अंतिम') && !x.includes('%'))));
let colRem = header.findIndex(x => x.includes('टिप्पणी') || x.includes('remark'));

console.log({ colBooth, col10, col13, col15, col18, colFin, colRem });

const cleanInt = (val) => {
  if (val === undefined || val === null) return '';
  let s = String(val).replace(/,/g, '').trim();
  if (s === '' || s === '-' || s === 'null') return '';
  const n = parseInt(s, 10);
  return isNaN(n) ? '' : n;
};

// Check data rows
let boothCount = 0;
for (let r = headerRowIdx + 1; r < rows.length; r++) {
  const row = rows[r];
  let bNo = String(row[colBooth] || '').trim();
  if (!bNo || bNo.includes('कुल') || bNo.includes('total') || isNaN(parseInt(bNo, 10))) continue;
  if (bNo.endsWith('.0')) bNo = bNo.slice(0, -2);

  boothCount++;
  if (boothCount <= 10 || boothCount === 152) {
    console.log(`[Booth ${bNo}] 10am=${cleanInt(row[col10])}, 1pm=${cleanInt(row[col13])}, 3pm=${cleanInt(row[col15])}, 6pm=${cleanInt(row[col18])}, fin=${cleanInt(row[colFin])}`);
  }
}
console.log('Total valid booth rows detected:', boothCount);
