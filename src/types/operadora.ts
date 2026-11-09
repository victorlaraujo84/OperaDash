import type { ColumnMapping } from '../lib/column-mapping';
export type AlarmCategory = "links" | "devices";
export type AlarmClassification = "Incidente" | "Oscilação" | "Não classificado";
export type ItsmMatchStatus = "matched-key" | "matched-internal" | "ambiguous" | "not-found" | "no-key";
export type ItsmSummaryCheck = "compatible" | "different" | "not-checked";
export type ItsmResolution = "unique-key" | "device-summary" | "internal-link" | "unique-internal" | "none";
export type ItsmLinkField = "LinkInterno-1" | "LinkInterno-2";

export interface ItsmInternalLink {
  field: ItsmLinkField;
  value: string;
  keys: string[];
}

export interface ItsmIncident {
  issueId?: string;
  parentId?: string;
  parentKey?: string;
  comments?: string[];
  relatedKeys?: string[];
  key: string;
  summary: string;
  reason?: string;
  itemType?: string;
  sourceType?: string;
  unitType?: string;
  unitName?: string;
  operator?: string;
  locality?: string;
  responsible: string;
  status: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  dueAt: Date | null;
  resolvedAt: Date | null;
  internalLinks: ItsmInternalLink[];
  sourceRow: number;
}

export interface ItsmJoinMatch {
  status: ItsmMatchStatus;
  matchField: "Chave da item" | ItsmLinkField | null;
  resolution: ItsmResolution;
  summaryCheck: ItsmSummaryCheck;
  commentKeys: string[];
  candidateKeys: string[];
  ticket: ItsmIncident | null;
}

export interface ItsmImportResult {
  columnMapping?: ColumnMapping;
  records: ItsmIncident[];
  fileName: string;
  sheetName: string;
  sheetNames: string[];
  warnings: string[];
  detectedColumns: DetectedColumn[];
  totalRows: number;
}

export interface InventoryColumn {
  index: number;
  label: string;
  populatedRows: number;
}

export interface DetectedColumn {
  column: string;
  field: string | null;
}

export interface InventoryAsset {
  id: string;
  name: string;
  categories: AlarmCategory[];
  operator: string | null;
  operatorMissing: boolean;
  operatorConflict: boolean;
  locality: string | null;
  localityMissing: boolean;
  localityConflict: boolean;
}

export interface InventoryImportResult {
  assets: InventoryAsset[];
  columns: InventoryColumn[];
  fileName: string;
  sheetName: string;
  sheetNames: string[];
  hostColumnIndex: number | null;
  categoryColumnIndex: number | null;
  operatorColumnIndex: number | null;
  localityColumnIndex: number | null;
  totalRows: number;
  uniqueHosts: number;
  duplicateRows: number;
  emptyHostRows: number;
  warnings: string[];
}

export interface InventoryDimensionRow {
  name: string;
  links: number;
  assets: number;
  monitoredHours: number | null;
  availabilityPercent: number | null;
  availabilityStatus: string;
  downtimeHours: number;
}

export interface InventoryOperationalSummary {
  totalLinks: number;
  totalAssets: number;
  operators: InventoryDimensionRow[];
  localities: InventoryDimensionRow[];
  averageOperatorAvailability: number | null;
  averageLocalityAvailability: number | null;
  hasOperatorColumn: boolean;
  hasLocalityColumn: boolean;
}

export interface ItsmJoinSummary {
  matchedByPrimary: number;
  matchedByInternal: number;
  ambiguous: number;
  notFound: number;
  noKey: number;
  summaryMismatch: number;
}

export interface AlarmRecord {
  id: string;
  sourceRow: number;
  alarm: string;
  device: string;
  hasDeviceIdentifier: boolean;
  sourceType: string;
  deviceType: string;
  operator: string;
  locality: string;
  responsible: string;
  trap: string;
  ticket: string;
  comment: string;
  startedAt: Date | null;
  endedAt: Date | null;
  durationMinutes: number | null;
  classification?: AlarmClassification;
  raw: Record<string, unknown>;
  itsmMatch?: ItsmJoinMatch | null;
}

export interface ImportResult {
  columnMapping?: ColumnMapping;
  records: AlarmRecord[];
  fileName: string;
  sheetName: string;
  sheetNames: string[];
  warnings: string[];
  detectedColumns: DetectedColumn[];
  undatedRows: number;
  rowsWithoutDuration: number;
  skippedBlankRows: number;
  totalRows: number;
}

export interface RankedEntity {
  name: string;
  alarms: number;
  downtimeMinutes: number;
}

export interface DashboardFilters {
  month: string;
  from: string;
  to: string;
  operator: string;
  locality: string;
  responsible: string;
  deviceType: string;
  sourceType: string;
  trap: string;
  itsmStatus: string;
  itsmResponsible: string;
  search: string;
}

export interface DaypartActuationRow {
  key: string;
  label: string;
  range: string;
  startMinute: number;
  total: number;
  acted: number;
  percent: number | null;
}

export interface DaypartActuationSummary {
  rows: DaypartActuationRow[];
  unclassified: number;
}

export interface AnnualMonthVolume {
  key: string;
  label: string;
  alarms: number;
}

export interface AnnualAlarmVolume {
  months: AnnualMonthVolume[];
  median: number | null;
}

export interface ItsmMonthlyVolume {
  key: string;
  label: string;
  alarms: number;
  ticketsOpened: number;
  ticketsResolved: number;
}

export interface ItsmOscillationOffender {
  name: string;
  operator: string;
  locality: string;
  alarms: number;
  totalMinutes: number;
  averageMinutes: number;
  sharePercent: number;
}

export interface ItsmReasonBreakdown {
  reason: string;
  tickets: number;
  sharePercent: number;
}

export interface ItsmOperationalSummary {
  ticketsOpened: number;
  ticketsResolved: number;
  averageResolutionMinutes: number | null;
  resolutionSamples: number;
  oscillationUnder40: number;
  oscillationUpTo10: number;
  oscillationUpTo25: number;
  oscillationUpTo40: number;
  oscillationOffenders: ItsmOscillationOffender[];
  reasonBreakdown: ItsmReasonBreakdown[];
  monthly: ItsmMonthlyVolume[];
}
