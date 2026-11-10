import type { AlarmCategory, AlarmRecord, DashboardFilters, ItsmIncident } from '../types/operadora';
import { dateInPeriod, isLinkRecord, normalizeLocalityKey } from './analytics';
import { uniqueTickets } from './itsm-correlation';
import { normalizeIssueKey } from './itsm-join';

export type SubtaskCategory = AlarmCategory | 'unknown';
export type SubtaskCategoryFilter = SubtaskCategory | 'all' | `tipo:${string}`;

export function categoryFromType(type = ''): SubtaskCategory {
  const value = normalizeLocalityKey(type);
  if (/^LINK\b/.test(value)) return 'links';
  if (/^(DISPOSITIVOS?|HOSTS?|EQUIPAMENTOS?)\b/.test(value)) return 'devices';
  return 'unknown';
}

export function getSubtaskReasons(
  subtasks: ItsmIncident[], incidents: ItsmIncident[], alerts: AlarmRecord[],
  filters: Pick<DashboardFilters, 'month' | 'from' | 'to'>, category: SubtaskCategoryFilter,
  units: { unitType: string; unitName: string } = { unitType: '', unitName: '' },
) {
  const parents = new Map(uniqueTickets(incidents).map(ticket => [normalizeIssueKey(ticket.key), ticket]));
  const categoriesByParent = new Map<string, Set<AlarmCategory>>();
  for (const alert of alerts) {
    const key = normalizeIssueKey(alert.itsmMatch?.ticket?.key ?? '');
    if (!parents.has(key)) continue;
    const categories = categoriesByParent.get(key) ?? new Set<AlarmCategory>();
    categories.add(isLinkRecord(alert) ? 'links' : 'devices');
    categoriesByParent.set(key, categories);
  }

  const inPeriod = dateInPeriod(filters);
  const reasons = new Map<string, { name: string; links: number; devices: number; unknown: number; total: number }>();
  const rows: (ItsmIncident & { category: SubtaskCategory })[] = [];
  let classified = 0;
  let undated = 0;
  const unitType = normalizeLocalityKey(units.unitType);
  const unitName = normalizeLocalityKey(units.unitName);
  for (const ticket of uniqueTickets(subtasks)) {
    if (unitType && normalizeLocalityKey(ticket.unitType ?? '') !== unitType) continue;
    if (unitName && normalizeLocalityKey(ticket.unitName ?? '') !== unitName) continue;
    const parentKey = normalizeIssueKey(ticket.parentKey);
    let type = categoryFromType(ticket.sourceType);
    if (!ticket.sourceType?.trim()) {
      type = categoryFromType(parents.get(parentKey)?.sourceType);
      const candidates = categoriesByParent.get(parentKey);
      if (type === 'unknown' && candidates?.size === 1) type = [...candidates][0];
    }
    if (category !== 'all' && type !== category && category !== `tipo:${normalizeLocalityKey(ticket.sourceType ?? '')}`) continue;
    if (!ticket.createdAt || Number.isNaN(ticket.createdAt.getTime())) undated++;
    if (!inPeriod(ticket.createdAt)) continue;
    rows.push({ ...ticket, category: type });
    const name = ticket.reason?.trim();
    if (!name) continue;
    classified++;
    const key = normalizeLocalityKey(name);
    const row = reasons.get(key) ?? { name, links: 0, devices: 0, unknown: 0, total: 0 };
    row[type]++;
    row.total++;
    reasons.set(key, row);
  }
  return { rows, classified, undated, reasons: [...reasons.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR')) };
}
