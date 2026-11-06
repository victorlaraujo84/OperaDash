export interface LocalAiMessage {
  role: "system" | "user";
  content: string;
}

export type LocalAiBridgeRequest =
  | { channel: "operadash-local-ai"; action: "models" }
  | { channel: "operadash-local-ai"; action: "chat"; messages: LocalAiMessage[] }
  | { channel: "operadash-local-ai"; action: "groq-models"; apiKey: string }
  | { channel: "operadash-local-ai"; action: "groq-chat"; apiKey: string; modelId: string; messages: LocalAiMessage[] }
  | { channel: "operadash-local-ai"; action: "custom-chat"; endpoint: string; apiKey: string; modelId: string; messages: LocalAiMessage[] };

export type LocalAiBridgeResponse =
  | { ok: true; modelId?: string; modelIds?: string[]; content?: string }
  | { ok: false; error: string };

export interface LocalAiDashboardContext {
  period: string;
  category: string;
  activeCategory: string;
  locality: string;
  appliedFilters: {
    operator: string;
    locality: string;
    alarmResponsible: string;
    deviceType: string;
    alarmType: string;
    trap: string;
    itsmStatus: string;
    itsmResponsible: string;
    textSearchActive: boolean;
  };
  alarmRows: number;
  downtimeHours: number;
  availabilityPercent: number | null;
  monitoredAssets: number;
  totalAssetHours: number | null;
  topAssets: Array<{ name: string; alarms: number; downtimeHours: number }>;
  topOperators: Array<{ name: string; alarms: number; downtimeHours: number }>;
  ticketsByTechnician: Array<{ name: string; tickets: number }>;
  oscillationOffenders: Array<{ name: string; operator: string; locality: string; alarms: number; totalMinutes: number; averageMinutes: number; sharePercent: number }>;
  mtfbByOperatorLocality: Array<{ operator: string; locality: string; failures: number; intervals: number; mtfbMinutes: number | null; medianMinutes: number | null; quality: string }>;
  categories: {
    links: LocalAiCategorySnapshot;
    devices: LocalAiCategorySnapshot;
  };
  itsm: {
    alarmsInScope: number;
    ticketsOpened: number;
    ticketsResolved: number;
    averageResolutionMinutes: number | null;
    reasonBreakdown: Array<{ reason: string; tickets: number; sharePercent: number }>;
    oscillationOffenders: Array<{ name: string; operator: string; locality: string; alarms: number; totalMinutes: number; averageMinutes: number; sharePercent: number }>;
    ticketsByTechnician: Array<{ name: string; tickets: number }>;
  };
  inventory: {
    totalLinks: number;
    totalAssets: number;
    averageOperatorAvailability: number | null;
    averageLocalityAvailability: number | null;
    operators: Array<{ name: string; links: number; assets: number; availabilityPercent: number | null }>;
    localities: Array<{ name: string; links: number; assets: number; availabilityPercent: number | null }>;
  };
  dataQuality: {
    alarmHostsMissingFromInventory: number;
    alarmRowsWithoutDateOrHost: number;
    inventoryLocalityIssues: number;
    alarmsWithoutUniqueItsmMatch: number;
    durationCoveragePercent: number;
    availabilityStatus: string;
    mtfbIntervals: number;
  };
}

export interface LocalAiCategorySnapshot {
  alarmRows: number;
  downtimeHours: number;
  netDowntimeHours: number;
  overlapHours: number;
  availabilityPercent: number | null;
  monitoredAssets: number;
  totalAssetHours: number | null;
  mttrMinutes: number | null;
  topAssets: Array<{ name: string; alarms: number; downtimeHours: number }>;
  topOperators: Array<{ name: string; alarms: number; downtimeHours: number }>;
  flapping: Array<{ name: string; oscillationsInWindow: number; totalMinutes: number; frequencyPerHour: number }>;
  mtfbByOperatorLocality: Array<{ operator: string; locality: string; failures: number; intervals: number; mtfbMinutes: number | null; medianMinutes: number | null; quality: string }>;
}
