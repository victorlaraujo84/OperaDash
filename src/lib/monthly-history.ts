import { filterRecords, getAnnualAlarmVolume } from './analytics';
import type { AlarmRecord, DashboardFilters } from '../types/operadora';

export function getMonthlyHistory(records: AlarmRecord[], filters: DashboardFilters, year: number) {
  const historyFilters = { ...filters, month: 'all', from: '', to: '' };
  const historyRecords = filterRecords(records, historyFilters);
  return getAnnualAlarmVolume(historyRecords, records, year);
}
