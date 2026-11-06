import assert from "node:assert/strict";
import { getItsmOperationalSummary } from "../src/lib/itsm-indicators";
import type { AlarmRecord, ItsmIncident } from "../src/types/operadora";

function ticket(key: string, createdAt: Date, resolvedAt: Date | null, reason = "", itemType = ""): ItsmIncident {
  return { key, summary: key, reason, itemType, responsible: "Ana", status: resolvedAt ? "Resolvido" : "Aberto", createdAt, updatedAt: createdAt, dueAt: null, resolvedAt, internalLinks: [], sourceRow: 1 };
}
function alarm(id: string, startedAt: Date, durationMinutes: number, itsm: ItsmIncident | null): AlarmRecord {
  return { id, sourceRow: Number(id), alarm: "Falha", device: `LINK-${id}`, hasDeviceIdentifier: true, sourceType: "LINK", deviceType: "LINK", operator: "Operadora A", locality: "São Paulo", responsible: "noc-solor", trap: "", ticket: itsm?.key ?? "", comment: itsm?.key ?? "", startedAt, endedAt: new Date(startedAt.getTime() + durationMinutes * 60_000), durationMinutes, raw: {}, itsmMatch: itsm ? { status: "matched-key", matchField: "Chave da item", resolution: "unique-key", summaryCheck: "compatible", commentKeys: [itsm.key], candidateKeys: [itsm.key], ticket: itsm } : null };
}

const first = ticket("INC-1", new Date(2025, 0, 2, 8), new Date(2025, 0, 2, 9), "Operadora - Link com Falha");
const second = ticket("INC-2", new Date(2025, 1, 2, 8), new Date(2025, 1, 2, 10), "", "Evento - Link de comunicação");
const records = [
  alarm("1", new Date(2025, 0, 2, 8), 8, first),
  alarm("2", new Date(2025, 0, 3, 8), 25, first),
  alarm("3", new Date(2025, 1, 2, 8), 40, second),
  alarm("4", new Date(2025, 1, 3, 8), 65, null),
];
const summary = getItsmOperationalSummary(records);
assert.equal(summary.ticketsOpened, 2, "tickets devem ser deduplicados pela chave ITSM");
assert.equal(summary.ticketsResolved, 2);
assert.equal(summary.averageResolutionMinutes, 90, "tempo médio usa Criado até Resolvido");
assert.equal(summary.oscillationUnder40, 2, "menos de 40 minutos exclui o alarme de exatamente 40");
assert.equal(summary.oscillationUpTo10, 1);
assert.equal(summary.oscillationUpTo25, 2);
assert.equal(summary.oscillationUpTo40, 3);
assert.equal(summary.oscillationOffenders.length, 2);
assert.equal(summary.oscillationOffenders[0].name, "LINK-2");
assert.equal(summary.oscillationOffenders[0].alarms, 1);
assert.equal(summary.oscillationOffenders[0].totalMinutes, 25);
assert.equal(summary.oscillationOffenders[0].sharePercent, 25 / 33 * 100);
assert.equal(summary.monthly.length, 2);
assert.equal(summary.monthly[0].alarms, 2);
assert.equal(summary.monthly[0].ticketsOpened, 1);
assert.equal(summary.monthly[0].ticketsResolved, 1);
assert.deepEqual(summary.reasonBreakdown, [
  { reason: "Evento - Link de comunicação", tickets: 1, sharePercent: 50 },
  { reason: "Operadora - Link com Falha", tickets: 1, sharePercent: 50 },
], "Tipo de item deve validar o motivo quando Motivo estiver vazio");
console.log("OK: indicadores ITSM, deduplicação, solução média, faixas cumulativas, ofensores e validação por Tipo de item validados.");
