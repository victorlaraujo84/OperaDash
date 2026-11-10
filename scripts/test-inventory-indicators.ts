import assert from "node:assert/strict";
import { getInventoryOperationalSummary } from "../src/lib/inventory-indicators";
import type { AlarmRecord, DashboardFilters, InventoryAsset } from "../src/types/operadora";

const filters: DashboardFilters = { month: "2025-09", from: "", to: "", operator: "", locality: "", responsible: "", deviceType: "", sourceType: "", trap: "", itsmStatus: "", itsmResponsible: "", search: "" };
function asset(id: string, category: "links" | "devices", operator: string, locality: string): InventoryAsset {
  return { id, name: id, categories: [category], operator, operatorMissing: false, operatorConflict: false, locality, localityMissing: false, localityConflict: false };
}
function alarm(id: string, device: string, operator: string, locality: string, durationMinutes: number): AlarmRecord {
  return { id, sourceRow: Number(id), alarm: "Falha", device, hasDeviceIdentifier: true, sourceType: device.startsWith("LINK") ? "LINK" : "ROUTER", deviceType: device.startsWith("LINK") ? "LINK" : "ROUTER", operator, locality, responsible: "noc-solor", trap: "", ticket: "", comment: "", startedAt: new Date(2025, 8, 2, 8), endedAt: new Date(2025, 8, 2, 8 + Math.ceil(durationMinutes / 60)), durationMinutes, raw: {} };
}

const assets = [asset("LINK-A1", "links", "Operadora A", "São Paulo"), asset("LINK-A2", "links", "Operadora A", "São Paulo"), asset("LINK-B1", "links", "Operadora B", "Rio de Janeiro"), asset("HOST-B1", "devices", "Operadora B", "Rio de Janeiro")];
const records = [alarm("1", "LINK-A1", "Operadora A", "São Paulo", 60), alarm("2", "HOST-B1", "Operadora B", "Rio de Janeiro", 30)];
const summary = getInventoryOperationalSummary(assets, records, filters, true, true);
assert.equal(summary.totalLinks, 3);
assert.equal(summary.totalAssets, 4);
assert.deepEqual(summary.operators.map((row) => [row.name, row.links, row.assets]), [["Operadora A", 2, 2], ["Operadora B", 1, 1]]);
assert.deepEqual(summary.localities.map((row) => [row.name, row.links, row.assets]), [["Rio de Janeiro", 1, 2], ["São Paulo", 2, 2]]);
assert.equal(summary.operators[0].availabilityPercent, (1439 / 1440) * 100);
assert.equal(summary.localities[1].availabilityPercent, (1439 / 1440) * 100);
assert.equal(summary.operators[1].availabilityPercent, 100);
assert.equal(summary.localities[0].availabilityPercent, 100);
assert.ok(summary.averageOperatorAvailability !== null);
assert.ok(summary.averageLocalityAvailability !== null);
console.log("OK: inventário agrupado por operadora/localidade e disponibilidade média validados.");
