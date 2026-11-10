import type { AlarmCategory, AlarmRecord, DashboardFilters, InventoryAsset, InventoryDimensionRow, InventoryOperationalSummary } from "../types/operadora";
import { filterRecords, getAvailability, isIncidentRecord, isLinkRecord, normalizeLocalityKey } from "./analytics";

function dimensionKey(value: string | null): string {
  return normalizeLocalityKey(value ?? "");
}

function displayName(value: string | null, fallback: string): string {
  const normalized = value?.trim();
  return normalized || fallback;
}

function scopedFilters(filters: DashboardFilters, dimension: "operator" | "locality", value: string): DashboardFilters {
  return {
    ...filters,
    operator: dimension === "operator" ? value : "",
    locality: dimension === "locality" ? value : "",
  };
}

function availabilityRow(
  name: string,
  assets: InventoryAsset[],
  records: AlarmRecord[],
  filters: DashboardFilters,
  dimension: "operator" | "locality",
  hasLocalityColumn: boolean,
  hasOperatorColumn: boolean,
): InventoryDimensionRow {
  const scoped = scopedFilters(filters, dimension, name);
  const filteredRecords = filterRecords(records, scoped);
  const availability = getAvailability(records, filteredRecords, scoped, assets, hasLocalityColumn, hasOperatorColumn);
  const availabilityPercent = availability.status === "no-match" ? 100 : availability.percent;
  return {
    name,
    links: assets.filter((asset) => asset.categories.includes("links")).length,
    assets: assets.length,
    monitoredHours: availability.totalHours,
    availabilityPercent,
    availabilityStatus: availability.status,
    downtimeHours: availability.downtimeHours,
  };
}

function groupAssets(assets: InventoryAsset[], dimension: "operator" | "locality"): Array<{ name: string; assets: InventoryAsset[] }> {
  const groups = new Map<string, { name: string; assets: InventoryAsset[] }>();
  for (const asset of assets) {
    const raw = dimension === "operator" ? asset.operator : asset.locality;
    const key = dimensionKey(raw);
    const name = displayName(raw, dimension === "operator" ? "Sem operadora" : "Sem localidade");
    const group = groups.get(key || `missing-${name}`) ?? { name, assets: [] };
    group.assets.push(asset);
    groups.set(key || `missing-${name}`, group);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function getInventoryOperationalSummary(
  assets: InventoryAsset[],
  records: AlarmRecord[],
  filters: DashboardFilters,
  hasLocalityColumn: boolean,
  hasOperatorColumn: boolean,
): InventoryOperationalSummary {
  const incidentRecords = records.filter(isIncidentRecord);
  const linkAssets = assets.filter((asset) => asset.categories.includes("links"));
  const linkIncidentRecords = incidentRecords.filter(isLinkRecord);
  const operatorGroups = groupAssets(linkAssets, "operator").filter((group) => group.name !== "Sem operadora");
  const localityGroups = groupAssets(assets, "locality").filter((group) => group.name !== "Sem localidade");
  const operators = operatorGroups.map((group) => availabilityRow(group.name, group.assets, linkIncidentRecords, filters, "operator", hasLocalityColumn, hasOperatorColumn));
  const localities = localityGroups.map((group) => availabilityRow(group.name, group.assets, incidentRecords, filters, "locality", hasLocalityColumn, hasOperatorColumn));
  const operatorAvailability = operators.flatMap((row) => row.availabilityPercent === null ? [] : [row.availabilityPercent]);
  const localityAvailability = localities.flatMap((row) => row.availabilityPercent === null ? [] : [row.availabilityPercent]);
  return {
    totalLinks: assets.filter((asset) => asset.categories.includes("links")).length,
    totalAssets: assets.length,
    operators,
    localities,
    averageOperatorAvailability: operatorAvailability.length ? operatorAvailability.reduce((sum, value) => sum + value, 0) / operatorAvailability.length : null,
    averageLocalityAvailability: localityAvailability.length ? localityAvailability.reduce((sum, value) => sum + value, 0) / localityAvailability.length : null,
    hasOperatorColumn,
    hasLocalityColumn,
  };
}

export function getInventoryCategoryAssets(assets: InventoryAsset[], category: AlarmCategory): InventoryAsset[] {
  return assets.filter((asset) => asset.categories.includes(category));
}

export function getInventoryCategoryRecords(records: AlarmRecord[], category: AlarmCategory): AlarmRecord[] {
  return records.filter((record) => isLinkRecord(record) === (category === "links"));
}
