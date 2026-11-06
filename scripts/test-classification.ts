import assert from "node:assert/strict";
import { filterByCategory, filterByCategoryAll, isIncidentRecord } from "../src/lib/analytics";
import type { AlarmRecord } from "../src/types/operadora";

function alarm(id: string, durationMinutes: number, sourceType = "LINK"): AlarmRecord {
  return {
    id, sourceRow: Number(id), alarm: "Alarme", device: `LINK-${id}`, hasDeviceIdentifier: true,
    sourceType, deviceType: "LINK", operator: "Operadora A", locality: "São Paulo", responsible: "NOC",
    trap: "", ticket: "", comment: "", startedAt: new Date(2025, 0, Number(id)), endedAt: null,
    durationMinutes, raw: {}, classification: durationMinutes >= 40 ? "Incidente" : "Oscilação",
  };
}

const records = [alarm("1", 39), alarm("2", 40), alarm("3", 120, "DEVICE")];
assert.equal(isIncidentRecord(records[0]), false);
assert.equal(isIncidentRecord(records[1]), true);
assert.equal(filterByCategoryAll(records, "links").length, 2, "a categoria completa preserva incidentes e oscilações");
assert.equal(filterByCategory(records, "links").length, 1, "a visão operacional considera somente duração >= 40");
assert.equal(filterByCategory(records, "devices").length, 1);
console.log("OK: classificação Incidente >= 40 minutos e Oscilação < 40 minutos validada.");
