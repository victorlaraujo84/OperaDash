import assert from 'node:assert/strict';
import { getSubtaskReasons } from '../src/lib/subtask-reasons';
import type { ItsmIncident } from '../src/types/operadora';

const task = (key: string, date: Date | null, reason: string, sourceType = '', parentKey = ''): ItsmIncident => ({
  key, reason, sourceType, parentKey, summary: '', responsible: '', status: '', createdAt: date,
  updatedAt: null, dueAt: null, resolvedAt: null, internalLinks: [], sourceRow: 1,
});
const feb = new Date(2026, 1, 28, 23, 59, 59, 999);
const rows = [
  task('NOC-1', feb, 'Energia', 'LINK'),
  task('NOC-2', feb, ' energia ', 'Dispositivo'),
  task('NOC-3', feb, 'Fibra', '', 'NOC-10'),
  task('NOC-4', feb, '', ''),
  task('NOC-5', new Date(2026, 2, 1), 'Energia', 'LINK'),
  task('NOC-6', null, 'Energia', 'LINK'),
  task('NOC-7', feb, 'DNS'),
];
const parents = [task('NOC-10', new Date(2025, 0), '', 'LINK')];
const filters = { month: '2026-02', from: '2026-02-28', to: '2026-02-28' };
const result = getSubtaskReasons([...rows, rows[0]], parents, [], filters, 'all');
assert.equal(result.rows.length, 5);
assert.equal(result.classified, 4);
assert.equal(result.undated, 1);
assert.deepEqual(result.reasons[0], { name: 'Energia', links: 1, devices: 1, unknown: 0, total: 2 });
assert.deepEqual(getSubtaskReasons(rows, parents, [], filters, 'links').rows.map(row => row.key), ['NOC-1', 'NOC-3']);
assert.equal(getSubtaskReasons(rows, parents, [], filters, 'devices').classified, 1);
assert.equal(getSubtaskReasons(rows, parents, [], filters, 'unknown').rows.length, 2);
assert.equal(getSubtaskReasons(rows, parents, [], { month: 'all', from: '', to: '' }, 'all').rows.length, 7);

const xlsx = await import('xlsx');
const { parseItsmWorkbook } = await import('../src/lib/itsm-parser');
const workbook = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet([
  ['Chave do item', 'Criado', 'Motivo do alarme', 'TIPO', 'TIPO_UND', 'UND_NOME'],
  ['NOC-20', '28/02/2026 13:00:00', 'Energia', 'LINK', 'Agência', 'Centro'],
  ['NOC-21', '28/02/2026 13:00:00', 'Fibra', 'LINK', 'Agência', 'Norte'],
  ['NOC-22', '28/02/2026 13:00:00', 'Fibra', 'DISPOSITIVO', 'Posto', 'Centro'],
]), 'Subtarefas');
const imported = parseItsmWorkbook(xlsx.write(workbook, { type: 'array', bookType: 'xlsx' }), 'subtarefas.xlsx');
assert.deepEqual(imported.records.map(row => [row.sourceType, row.unitType, row.unitName]), [
  ['LINK', 'Agência', 'Centro'], ['LINK', 'Agência', 'Norte'], ['DISPOSITIVO', 'Posto', 'Centro'],
]);
assert.equal(imported.columnMapping?.unitType, 4);
assert.equal(imported.columnMapping?.unitName, 5);
const unit = getSubtaskReasons(imported.records, [], [], filters, 'links', { unitType: 'Agencia', unitName: 'Centro' });
assert.deepEqual(unit.rows.map(row => row.key), ['NOC-20']);
assert.equal(unit.reasons[0].name, 'Energia');
const remapped = parseItsmWorkbook(xlsx.write(workbook, { type: 'array', bookType: 'xlsx' }), 'subtarefas.xlsx', 'Subtarefas', { unitType: 5, unitName: 4 });
assert.equal(remapped.records[0].unitType, 'Centro');
assert.equal(remapped.records[0].unitName, 'Agência');
assert.equal(getSubtaskReasons(imported.records, [], [], filters, 'devices', { unitType: 'Agência', unitName: 'Centro' }).rows.length, 0);
