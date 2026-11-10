import assert from "node:assert/strict";
import { getFlappingRows, getNetDowntime } from "../src/lib/analytics";
import type { AlarmRecord } from "../src/types/operadora";

function alarm(id: string, device: string, start: string, end: string, durationMinutes: number): AlarmRecord {
  return {
    id, sourceRow: Number(id), alarm: "Oscilação", device, hasDeviceIdentifier: true, sourceType: "LINK", deviceType: "LINK",
    operator: "Operadora A", locality: "SP", responsible: "", trap: "", ticket: "", comment: "",
    startedAt: new Date(start), endedAt: new Date(end), durationMinutes, classification: "Oscilação", raw: {},
  };
}

const records = [
  alarm("1", "LINK-01", "2026-10-01T10:00:00Z", "2026-10-01T11:00:00Z", 60),
  alarm("2", "LINK-01", "2026-10-01T10:30:00Z", "2026-10-01T11:30:00Z", 60),
  alarm("3", "LINK-02", "2026-10-01T10:00:00Z", "2026-10-01T11:00:00Z", 60),
  alarm("4", "LINK-02", "2026-10-01T12:00:00Z", "2026-10-01T13:00:00Z", 60),
  alarm("5", "LINK-02", "2026-10-01T14:00:00Z", "2026-10-01T15:00:00Z", 60),
  alarm("6", "LINK-02", "2026-10-01T16:00:00Z", "2026-10-01T17:00:00Z", 60),
];

const net = getNetDowntime(records.slice(0, 2));
assert.equal(net.grossMinutes, 120);
assert.equal(net.netMinutes, 90);
assert.equal(net.overlapMinutes, 30);

const flapping = getFlappingRows(records.slice(2), 360, 4);
assert.equal(flapping.length, 1);
assert.equal(flapping[0].name, "LINK-02");
assert.equal(flapping[0].windowCount, 4);

console.log("OK: união de intervalos por ativo e detecção de flapping validadas.");
