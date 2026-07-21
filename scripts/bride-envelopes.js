/* Export the bride list to Excel with two envelope-salutation columns (AR-env, En-env).
 * Only the HEAD of each group gets a salutation; other members are left blank. */
const fs = require('fs');
const XLSX = require('xlsx');

const SRC = 'C:/Users/hrach/AppData/Local/Temp/claude/C--Users-hrach-OneDrive---Rachidi-Home-S-A-R-L-Documents-hsrachidi-wedding/03c7272a-d3d6-4430-881c-e6518906951b/scratchpad/groom/bride-list.json';
const OUT = 'C:/Users/hrach/OneDrive - Rachidi Home S.A.R.L/Wedding/Guest List/Bride_guest-list_envelopes.xlsx';

// head groupCode -> { g: 'M'|'F', ar: '<arabic full name>', flag?: true }
// flag = gender/name I'm not fully sure of — please double-check.
const HEAD = {
  b001: { g: 'M', ar: 'فيصل رشيدي' },
  b002: { g: 'M', ar: 'غسان رشيدي' },
  b003: { g: 'F', ar: 'رنا رشيدي' },
  b004: { g: 'F', ar: 'نور رشيدي', flag: true },
  b005: { g: 'M', ar: 'حسين رشيدي' },
  b006: { g: 'M', ar: 'وسيم رشيدي' },
  b007: { g: 'M', ar: 'حسن رشيدي' },
  b008: { g: 'F', ar: 'عبير رشيدي' },
  b009: { g: 'M', ar: 'عبدالله رشيدي' },
  b010: { g: 'F', ar: 'نانسي رشيدي' },
  b011: { g: 'M', ar: 'فؤاد رشيدي' },
  b012: { g: 'F', ar: 'هيام سعد' },
  b013: { g: 'F', ar: 'ريم رشيدي' },
  b014: { g: 'F', ar: 'فرح رشيدي' },
  b015: { g: 'M', ar: 'علي رشيدي' },
  b016: { g: 'M', ar: 'محمد رشيدي' },
  b017: { g: 'M', ar: 'يوسف رشيدي' },
  b018: { g: 'F', ar: 'مايا رشيدي' },
  b019: { g: 'F', ar: 'ياسمين رشيدي' },
  b020: { g: 'F', ar: 'هيام رشيدي' },
  b021: { g: 'F', ar: 'سلمى لقيس' },
  b022: { g: 'F', ar: 'شاما رشيدي', flag: true },
  b023: { g: 'M', ar: 'نديم داوي' },
  b024: { g: 'M', ar: 'مازن داوي' },
  b025: { g: 'M', ar: 'باسم داوي' },
  b026: { g: 'F', ar: 'سعاد رشيدي' },
  b027: { g: 'F', ar: 'ليديا زعرور' },
  b028: { g: 'M', ar: 'سامي زعرور' },
  b029: { g: 'F', ar: 'سميرة زعرور' },
  b030: { g: 'F', ar: 'مها زعرور' },
  b031: { g: 'F', ar: 'بدرية عيسى' },
  b032: { g: 'F', ar: 'ريما عيسى' },
  b033: { g: 'M', ar: 'أحمد حيدر' },
  b034: { g: 'F', ar: 'سوزانا صادق' },
  b035: { g: 'F', ar: 'ماجدة صادق' },
  b036: { g: 'F', ar: 'أدريانا صادق', flag: true },
  b037: { g: 'M', ar: 'أسعد حيدر' },
  b038: { g: 'F', ar: 'ديانا حيدر' },
  b039: { g: 'M', ar: 'حسين حيدر' },
  b040: { g: 'F', ar: 'ندى حيدر' },
  b041: { g: 'F', ar: 'لينا عطوي' },
  b042: { g: 'F', ar: 'لمى عطوي' },
  b043: { g: 'F', ar: 'سهى أبو خضود' },
  b044: { g: 'F', ar: 'ليندا فاعور' },
  b045: { g: 'F', ar: 'لارا عطوي' },
  b046: { g: 'F', ar: 'أميمة رحيّل' },
  b047: { g: 'M', ar: 'أحمد رحيّل' },
  b048: { g: 'M', ar: 'جعفر غصن' },
  b049: { g: 'M', ar: 'خليل' },
  b050: { g: 'M', ar: 'أحمد' },
  b051: { g: 'M', ar: 'حسن يقظان' },
  b052: { g: 'F', ar: 'مروة حسيني' },
  b053: { g: 'F', ar: 'جوانا رمضان' },
  b054: { g: 'F', ar: 'فرح عبد الواحد' },
  b055: { g: 'F', ar: 'نور كنسو', flag: true },
  b056: { g: 'M', ar: 'يوسف شومان' },
  b057: { g: 'F', ar: 'تينا فخران' },
  b058: { g: 'M', ar: 'محمد خضر' },
  b059: { g: 'M', ar: 'عمر فواز' },
  b060: { g: 'M', ar: 'هادي خليفة' },
  b061: { g: 'F', ar: 'تمارا صباغ' },
  b062: { g: 'F', ar: 'ليا بريدي' },
  b063: { g: 'F', ar: 'تالا خلف' },
  b064: { g: 'F', ar: 'سارة مديحلي' },
  b065: { g: 'F', ar: 'سارة درويش' },
  b066: { g: 'F', ar: 'نور درويش', flag: true },
  b067: { g: 'F', ar: 'شيرين درويش' },
  b068: { g: 'F', ar: 'زينة زين' },
  b069: { g: 'M', ar: 'رضا مرجي', flag: true },
  b070: { g: 'M', ar: 'عزت رشيدي' },
  b071: { g: 'M', ar: 'إبراهيم رشيدي' },
  b072: { g: 'F', ar: 'هدى فرحات' },
};

function salutations(name, seats, info) {
  const family = seats > 1;
  if (info.g === 'M') {
    return {
      ar: family ? `حضرة السيد ${info.ar} وعائلته الكريمة` : `حضرة السيد ${info.ar} المحترم`,
      en: family ? `Mr. ${name} and His Esteemed Family` : `Mr. ${name}`,
    };
  }
  return {
    ar: family ? `حضرة السيدة ${info.ar} وعائلتها الكريمة` : `حضرة السيدة ${info.ar} المحترمة`,
    en: family ? `Mrs. ${name} and Her Esteemed Family` : `Mrs. ${name}`,
  };
}

const rows = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const HEADER = ['Name', 'Phone', 'Side', 'Circle', 'Seats', 'Group ID', 'RSVP', 'Notes', 'AR-env', 'En-env'];
const aoa = [HEADER];
const flagged = [];
let headsFilled = 0;

for (const r of rows) {
  let arEnv = '', enEnv = '';
  if (r.isHead) {
    const info = HEAD[r.groupCode];
    if (!info) throw new Error('No head mapping for ' + r.groupCode + ' (' + r.name + ')');
    const s = salutations(r.name, r.seats, info);
    arEnv = s.ar; enEnv = s.en; headsFilled++;
    if (info.flag) flagged.push(`${r.groupCode} ${r.name} → ${info.g === 'M' ? 'Mr' : 'Mrs'} / ${info.ar}`);
  }
  aoa.push([r.name, r.phone, 'bride', r.circle, r.seats, r.groupCode, r.rsvpManual, r.notes, arEnv, enEnv]);
}

const ws = XLSX.utils.aoa_to_sheet(aoa);
ws['!cols'] = [
  { wch: 22 }, { wch: 14 }, { wch: 7 }, { wch: 11 }, { wch: 6 }, { wch: 9 }, { wch: 8 }, { wch: 14 }, { wch: 42 }, { wch: 40 },
];
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Bride');
XLSX.writeFile(wb, OUT);

console.log('Wrote', OUT);
console.log('Rows:', rows.length, '| heads with salutation:', headsFilled);
console.log('\nFLAGGED (please double-check gender/name):');
flagged.forEach((f) => console.log('  ', f));
