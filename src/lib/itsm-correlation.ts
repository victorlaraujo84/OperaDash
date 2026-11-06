import type { AlarmRecord, ItsmIncident } from '../types/operadora';
import { extractIssueKeys, normalizeIssueKey } from './itsm-join';

export interface CorrelationRow {
  alert: AlarmRecord;
  incidentKeys: string[];
  subtaskKeys: string[];
  reasons: string[];
  reasonStatus: 'confirmed' | 'conflicting' | 'missing';
  durationMinutes: number | null;
}
export interface ReasonCount { name: string; subtasks: number; incidents: number }

/** Latest dated version wins; ties use the last row. Missing keys are never identities. */
export function uniqueTickets(records: ItsmIncident[]): ItsmIncident[] {
  const byKey = new Map<string, ItsmIncident>();
  for (const record of records) {
    const key = normalizeIssueKey(record.key);
    if (!key) continue;
    const previous = byKey.get(key);
    if (!previous || (record.updatedAt?.getTime() ?? 0) >= (previous.updatedAt?.getTime() ?? 0)) byKey.set(key, record);
  }
  return [...byKey.values()];
}

export function correlateItsm(alerts: AlarmRecord[], incidentRecords: ItsmIncident[], subtaskRecords: ItsmIncident[], scopeIncidentKeys?: Set<string>) {
  const allIncidents = uniqueTickets(incidentRecords), subtasks = uniqueTickets(subtaskRecords);
  const incidents = scopeIncidentKeys ? allIncidents.filter(record => scopeIncidentKeys.has(normalizeIssueKey(record.key))) : allIncidents;
  const incidentKeys = new Set(incidents.map(record => normalizeIssueKey(record.key)));
  const incidentByKey = new Map(incidents.map(record => [normalizeIssueKey(record.key), record]));
  const keysById = new Map<string, Set<string>>();
  for (const record of allIncidents) {
    if (!record.issueId) continue;
    const keys = keysById.get(record.issueId) ?? new Set<string>();
    keys.add(normalizeIssueKey(record.key)); keysById.set(record.issueId, keys);
  }
  const parentResolution = (record: ItsmIncident) => {
    const key = normalizeIssueKey(record.parentKey);
    const idKeys = keysById.get(record.parentId ?? '');
    if (idKeys && (idKeys.size > 1 || (key && !idKeys.has(key)))) return { key: '', ambiguous: true };
    return { key: key || [...(idKeys ?? [])][0] || '', ambiguous: false };
  };
  const parentFor = (record: ItsmIncident) => parentResolution(record).key;
  const subtasksByParent = new Map<string, ItsmIncident[]>();
  let linkedSubtasks = 0;
  const reasonGroups = new Map<string, { name: string; subtasks: number; incidents: Set<string> }>();
  for (const subtask of subtasks) {
    const parent = parentFor(subtask);
    if (!incidentKeys.has(parent)) continue;
    linkedSubtasks++;
    subtasksByParent.set(parent, [...(subtasksByParent.get(parent) ?? []), subtask]);
    const reason = subtask.reason?.trim();
    if (!reason) continue;
    const key = reason.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
    const group = reasonGroups.get(key) ?? { name: reason, subtasks: 0, incidents: new Set<string>() };
    group.subtasks++; group.incidents.add(parent); reasonGroups.set(key, group);
  }
  const reasonsFor = (tickets: ItsmIncident[]) => [...new Map(tickets.flatMap(t => t.reason?.trim() ? [[t.reason.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' '), t.reason.trim()] as const] : [])).values()];
  const rows: CorrelationRow[] = alerts.map(alert => {
    const keys = [...new Set([...extractIssueKeys(alert.ticket), ...extractIssueKeys(alert.comment)])].filter(key => incidentKeys.has(key));
    const related = keys.flatMap(key => subtasksByParent.get(key) ?? []);
    // Choose evidence per incident before combining multiple incident causes.
    const evidence = keys.flatMap(key => {
      const classifiedSubtasks = (subtasksByParent.get(key) ?? []).filter(ticket => ticket.reason?.trim());
      return classifiedSubtasks.length ? classifiedSubtasks : incidentByKey.has(key) ? [incidentByKey.get(key)!] : [];
    });
    const reasons = reasonsFor(evidence);
    return { alert, incidentKeys: keys, subtaskKeys: [...new Set(related.map(t => normalizeIssueKey(t.key)))], reasons, reasonStatus: reasons.length > 1 ? 'conflicting' : reasons.length === 1 ? 'confirmed' : 'missing', durationMinutes: alert.durationMinutes };
  });
  return {
    rows, incidents, subtasks: subtasks.map(record => ({ ...record, parentKey: parentFor(record) })), linkedSubtasks,
    linkedAlerts: rows.filter(row => row.incidentKeys.length).length,
    confirmedAlerts: rows.filter(row => row.reasonStatus === 'confirmed').length,
    ambiguousSubtasks: subtasks.filter(record => parentResolution(record).ambiguous).length,
    conflictingIncidents: [...subtasksByParent.values()].filter(tickets => reasonsFor(tickets).length > 1).length,
    reasons: [...reasonGroups.values()].map(group => ({ name: group.name, subtasks: group.subtasks, incidents: group.incidents.size } satisfies ReasonCount)).sort((a, b) => b.subtasks - a.subtasks || a.name.localeCompare(b.name)),
    missingIncidentKeys: incidentRecords.filter(record => !normalizeIssueKey(record.key)).length,
    missingSubtaskKeys: subtaskRecords.filter(record => !normalizeIssueKey(record.key)).length,
  };
}
