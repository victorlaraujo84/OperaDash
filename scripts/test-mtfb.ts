import assert from "node:assert/strict";
import { getMtfbByOperatorLocality, getMtfbSummary } from "../src/lib/analytics";
import type { AlarmRecord } from "../src/types/operadora";

function alarm(id: string, operator: string, locality: string, startedAt: string | null): AlarmRecord {
  return {
    id, sourceRow: Number(id), alarm: "Falha", device: `${operator}-${locality}-${id}`, hasDeviceIdentifier: true,
    sourceType: "LINK", deviceType: "Link", operator, locality, responsible: "", trap: "", ticket: "", comment: "",
    startedAt: startedAt ? new Date(startedAt) : null, endedAt: null, durationMinutes: null, raw: {},
  };
}

const rows = getMtfbByOperatorLocality([
  alarm("1", "Operadora A", "CAI", "2026-01-01T00:00:00Z"),
  alarm("2", "Operadora A", "CAI", "2026-01-01T01:00:00Z"),
  alarm("3", "Operadora A", "CAI", "2026-01-01T03:00:00Z"),
  alarm("4", "Operadora B", "CAI", "2026-01-01T00:00:00Z"),
  alarm("5", "Operadora B", "CAI", "2026-01-01T02:00:00Z"),
  alarm("6", "Operadora A", "CAP", "2026-01-01T00:00:00Z"),
  alarm("7", "", "", null),
]);

assert.equal(rows.length, 3);
assert.equal(rows[0].mtfbMinutes, 90);
assert.equal(rows[0].medianMinutes, 90);
assert.equal(rows[0].minMinutes, 60);
assert.equal(rows[0].maxMinutes, 120);
assert.equal(rows[0].quality, "amostra pequena");
assert.deepEqual(rows[0].intervalMinutes, [60, 120]);
assert.equal(rows[1].medianMinutes, 120);
assert.equal(rows[2].quality, "sem base");
const summary = getMtfbSummary(rows);
assert.equal(summary.intervals, 3);
assert.equal(summary.meanMinutes, 100);
assert.equal(summary.medianMinutes, 120);
assert.equal(summary.groupsWithBase, 2);
console.log("OK: MTFB agrupado por operadora/localidade com média ponderada, mediana, extremos e qualidade validados.");
