import assert from 'node:assert/strict';
import { filterRecords } from '../src/lib/analytics';
import type { AlarmRecord, DashboardFilters, ItsmIncident } from '../src/types/operadora';

const empty: DashboardFilters = { month: 'all', from: '', to: '', operator: '', locality: '', responsible: '', deviceType: '', sourceType: '', trap: '', itsmStatus: '', itsmResponsible: '', search: '' };
const ticket: ItsmIncident = { key: 'NOC-7', summary: 'Queda de comunicação', responsible: 'Equipe ITSM', status: 'Resolvido', createdAt: null, updatedAt: null, dueAt: null, resolvedAt: null, internalLinks: [], sourceRow: 1 };
const first: AlarmRecord = {
  id: 'a', sourceRow: 1, alarm: 'Conectividade', device: 'LINK-1', hasDeviceIdentifier: true,
  sourceType: 'LINK', deviceType: 'Roteador', operator: 'Fibra A', locality: 'São Paulo', responsible: 'NOC',
  trap: 'SNMP', ticket: '', comment: '', startedAt: new Date(2026, 1, 28, 23, 59, 59, 999), endedAt: null,
  durationMinutes: 45, classification: 'Incidente', raw: {},
  itsmMatch: { status: 'matched-key', matchField: 'Chave da item', resolution: 'unique-key', summaryCheck: 'not-checked', ticket, commentKeys: [], candidateKeys: [ticket.key] },
};
const second: AlarmRecord = {
  ...first, id: 'b', device: 'HOST-2', sourceType: 'HOST', deviceType: 'Servidor', operator: 'Fibra B',
  locality: 'Santos', responsible: 'Infra', trap: 'ICMP', startedAt: new Date(2026, 2, 1), itsmMatch: undefined,
};
const records = [first, second, { ...second, id: 'c', startedAt: null }];
const cases = [
  ['month', '2026-02'], ['to', '2026-02-28'], ['operator', 'fibra a'], ['locality', 'SAO PAULO'],
  ['responsible', 'noc'], ['deviceType', 'roteador'], ['sourceType', 'link'], ['trap', 'snmp'],
  ['itsmStatus', 'resolvido'], ['itsmResponsible', 'equipe itsm'], ['search', '  NOC-7  '],
] as const;
for (const [field, value] of cases) {
  assert.deepEqual(filterRecords(records, { ...empty, [field]: value }).map(row => row.id), ['a'], field);
}
assert.deepEqual(filterRecords(records, { ...empty, from: '2026-03-01' }).map(row => row.id), ['b']);
assert.equal(filterRecords(records, { ...empty, month: '2026-02', from: '2026-03-01' }).length, 0);
assert.equal(filterRecords(records, { ...empty, operator: 'Fibra B', itsmStatus: 'Resolvido' }).length, 0);
assert.deepEqual(filterRecords(records, empty).map(row => row.id), ['a', 'b', 'c']);
