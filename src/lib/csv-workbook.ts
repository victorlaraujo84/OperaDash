import * as XLSX from 'xlsx';

/** CSVs are decoded locally. Strings remain strings so Jira dates and IDs are not coerced. */
export function readInputWorkbook(buffer: ArrayBuffer, fileName: string): XLSX.WorkBook {
  if (!/\.csv$/i.test(fileName)) return XLSX.read(buffer, { type: 'array', cellDates: true, dense: false });
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
  catch { text = new TextDecoder('windows-1252').decode(buffer); }
  text = text.replace(/^\uFEFF/, '');
  // TelcoManager exports a report preamble before the actual table.
  const lines = text.split(/\r?\n/);
  const header = lines.findIndex(line => /^"?Alarme"?[;,\t]/i.test(line.trim()) && /Dispositivo/i.test(line));
  if (header >= 0) text = lines.slice(header).join('\n');
  const firstLine = text.split(/\r?\n/, 1)[0];
  const separators = [',', ';', '\t'];
  const delimiter = separators.sort((a, b) => splitCsv(firstLine, b)[0].length - splitCsv(firstLine, a)[0].length)[0];
  const rows = splitCsv(text, delimiter).filter(row => row.some(cell => cell.trim()) && !(/^Total:\s*\d+\s*$/i.test(row[0]) && row.slice(1).every(cell => !cell.trim())));
  if (rows.length < 2 || rows[0].length < 2) throw new Error('O CSV precisa de cabeçalho e registros separados por vírgula, ponto e vírgula ou tabulação.');
  const invalid = rows.findIndex(row => row.length !== rows[0].length);
  if (invalid >= 0) throw new Error(`CSV com quantidade de colunas inconsistente no registro ${invalid + 1}. Confira aspas e separadores.`);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'CSV');
  return workbook;
}

function splitCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted && char === '\\' && text[i + 1] === '"') { value += '"'; i++; }
    else if (char === '"' && (quoted || value.length === 0)) {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) { row.push(value); value = ''; }
    else if ((char === '\r' || char === '\n') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(value); rows.push(row); row = []; value = '';
    } else value += char;
  }
  if (quoted) throw new Error('O CSV contém um campo com aspas não fechadas.');
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}
