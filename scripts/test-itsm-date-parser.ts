import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { parseItsmWorkbook } from '../src/lib/itsm-parser';
// Portable fixture: no external files or operational data are needed by the suite.
const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
  ['Chave da item', 'Criado', 'Atualizado(a)', 'Resolvido', 'Data limite'],
  ...months.map((month, i) => ['INC-' + (i+1), '02/' + month + '/26 2:00 PM', '02/' + month + '/26 12:30 AM', '03/' + month + '/26 12:00 PM', '']),
]), 'ITSM');
const result = parseItsmWorkbook(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }), 'fixture.xlsx');
assert.equal(result.records.length, 12);
result.records.forEach((record, month) => {
  assert.equal(record.createdAt?.getFullYear(), 2026);
  assert.equal(record.createdAt?.getMonth(), month);
  assert.equal(record.createdAt?.getDate(), 2);
  assert.equal(record.createdAt?.getHours(), 14);
  assert.equal(record.createdAt?.getMinutes(), 0);
  assert.equal(record.updatedAt?.getHours(), 0);
  assert.equal(record.updatedAt?.getMinutes(), 30);
  assert.equal(record.resolvedAt?.getHours(), 12);
  assert.equal(record.dueAt, null);
});
console.log('OK: datas Jira pt-BR, 12 meses, AM/PM e prazo vazio.');
