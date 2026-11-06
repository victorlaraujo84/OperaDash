import assert from "node:assert/strict";
import { joinAlarmsWithItsm } from "../src/lib/itsm-join";
import type { AlarmRecord, ItsmIncident } from "../src/types/operadora";

const alarm: AlarmRecord = {
  id: "alarm-1", sourceRow: 2, alarm: "Falha", device: "LINK-01", hasDeviceIdentifier: true,
  sourceType: "LINK", deviceType: "LINK", operator: "K2", locality: "RIOMAIS", responsible: "NOC",
  trap: "", ticket: "", comment: "INC-100", startedAt: new Date(2025, 0, 1), endedAt: null,
  durationMinutes: 60, raw: {}, classification: "Incidente",
};
const base: ItsmIncident = {
  key: "INC-100", summary: "LINK-01", responsible: "Ana", status: "Aberto", createdAt: new Date(2025, 0, 1),
  updatedAt: null, dueAt: null, resolvedAt: null, internalLinks: [], sourceRow: 2,
};
const result = joinAlarmsWithItsm([alarm], [
  { ...base, operator: "DISPOSITIVO", locality: "CAV", sourceType: "LINK" },
  { ...base, operator: "K2", locality: "RIOMAIS", sourceType: "LINK", sourceRow: 3 },
]);
assert.equal(result[0].itsmMatch?.ticket?.sourceRow, 3, "as três dimensões do ITSM devem desempatar tickets com a mesma chave");
assert.equal(result[0].itsmMatch?.status, "matched-key");
console.log("OK: desempate ITSM por TIPO, operadora e localidade validado.");
