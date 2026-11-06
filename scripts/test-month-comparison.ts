import assert from "node:assert/strict";
import { getMonthComparison, getPercentagePointTrend, getRankComparisonSample, getRelativeTrend, hasRankMetricBaseline } from "../src/lib/month-comparison";
import type { DashboardFilters } from "../src/types/operadora";

function makeFilters(overrides: Partial<DashboardFilters> = {}): DashboardFilters {
  return {
    month: "all",
    from: "",
    to: "",
    operator: "",
    locality: "",
    responsible: "",
    deviceType: "",
    sourceType: "",
    trap: "",
    itsmStatus: "",
    itsmResponsible: "",
    search: "",
    ...overrides,
  };
}

const fullJanuary = getMonthComparison(makeFilters({ month: "2026-01", operator: "Operadora A", locality: "Recife" }));
assert.ok(fullJanuary);
assert.equal(fullJanuary.previousMonth, "2025-12", "janeiro compara com dezembro do ano anterior");
assert.equal(fullJanuary.previousFilters.month, "2025-12");
assert.equal(fullJanuary.previousFilters.operator, "Operadora A", "filtros operacionais são preservados");
assert.equal(fullJanuary.previousFilters.locality, "Recife");
assert.equal(fullJanuary.previousFilters.from, "", "um mês sem datas manuais compara o mês completo");

const leapDay = getMonthComparison(makeFilters({ month: "2024-03", from: "2024-03-31", to: "2024-03-31" }));
assert.ok(leapDay);
assert.equal(leapDay.previousFilters.from, "2024-02-29", "datas equivalentes são limitadas ao último dia do mês anterior");
assert.equal(leapDay.previousFilters.to, "2024-02-29");

const clippedSelectedMonth = getMonthComparison(makeFilters({ month: "2025-09", from: "2025-09-20", to: "2025-10-05" }));
assert.ok(clippedSelectedMonth, "um intervalo que cruza o limite do mês é normalizado pela interseção com o mês selecionado");
assert.equal(clippedSelectedMonth.previousFilters.from, "2025-08-20");
assert.equal(clippedSelectedMonth.previousFilters.to, "2025-08-30", "a base anterior conserva o dia equivalente após deslocar a janela para o mês-base");
assert.equal(getMonthComparison(makeFilters({ month: "2025-09", from: "2025-10-01", to: "2025-10-02" })), null, "datas sem interseção com o mês selecionado não geram comparação");
assert.equal(getMonthComparison(makeFilters({ month: "2025-09", from: "2025-08-01", to: "2025-08-31" })), null, "uma faixa inteiramente anterior ao mês selecionado não gera comparação");

const inferredMonth = getMonthComparison(makeFilters({ month: "all", from: "2024-03-10", to: "2024-03-20", operator: "Operadora B" }));
assert.ok(inferredMonth, "um intervalo contido em um único mês permite comparação");
assert.equal(inferredMonth.currentMonth, "2024-03");
assert.equal(inferredMonth.previousFilters.month, "2024-02");
assert.equal(inferredMonth.previousFilters.from, "2024-02-10");
assert.equal(inferredMonth.previousFilters.to, "2024-02-20");
assert.equal(inferredMonth.previousFilters.operator, "Operadora B");
assert.equal(getMonthComparison(makeFilters({ month: "all", from: "2024-02-20", to: "2024-03-10" })), null, "um intervalo de vários meses não é comparado com um único mês anterior");
assert.equal(getMonthComparison(makeFilters({ month: "2024-03", from: "2024-03-20", to: "2024-03-10" })), null, "um recorte de datas inválido não gera comparação");

assert.deepEqual(getRelativeTrend(150, 100), { direction: "up", text: "+50,0%" });
assert.deepEqual(getRelativeTrend(80, 100), { direction: "down", text: "−20,0%" });
assert.deepEqual(getRelativeTrend(10, 0), { direction: "new", text: "Novo" }, "não inventa percentual quando o mês-base é zero");
assert.deepEqual(getRelativeTrend(0, 0), { direction: "flat", text: "0,0%" });
assert.deepEqual(getPercentagePointTrend(72.5, 65), { direction: "up", text: "+7,5 p.p." });
assert.deepEqual(getPercentagePointTrend(null, 65), { direction: "unavailable", text: "Sem base" });
assert.equal(hasRankMetricBaseline(true, "downtime", [], 2), false, "um mês-base com alarmes filtrados mas sem nenhuma duração válida não vira baseline de indisponibilidade");
assert.equal(hasRankMetricBaseline(true, "downtime", [{ name: "LINK-A" }], 1), true, "durações válidas permitem comparar o ranking de indisponibilidade");
assert.equal(hasRankMetricBaseline(true, "downtime", [], 0), true, "cobertura no mês-base sem alarmes que atendam aos filtros representa indisponibilidade zero");
assert.equal(hasRankMetricBaseline(true, "alarms", []), true, "uma base coberta sem alarmes no filtro representa zero válido para contagem");
assert.equal(hasRankMetricBaseline(false, "alarms", []), false, "sem dados de cobertura do mês-base a contagem também é Sem base");

const currentTop = ["A", "B", "C", "D", "E", "F"].map((name, index) => ({ name, value: 10 - index }));
const previousTop = ["F", "G", "H", "I", "J", "A"].map((name, index) => ({ name, value: 20 - index }));
const sample = getRankComparisonSample(currentTop, previousTop);
assert.equal(sample.length, 10, "a amostra inclui até cinco nomes de cada período");
assert.deepEqual(sample.map((row) => row.name), ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]);
assert.deepEqual(sample.find((row) => row.name === "F"), { name: "F", current: { name: "F", value: 5 }, previous: { name: "F", value: 20 }, currentRank: null, previousRank: 1 }, "um nome que saiu do TOP 5 atual mantém seu valor atual e do mês-base");
assert.equal(sample.find((row) => row.name === "G")?.current, null, "nomes que saíram do TOP atual não recebem dado inventado");
assert.equal(sample.find((row) => row.name === "A")?.previousRank, null, "um item pode estar no TOP atual mas fora do TOP 5 anterior");

console.log("OK: janelas mensais equivalentes, virada de ano, filtros preservados, tendências percentuais/p.p. e amostra unida dos TOP 5 validados.");
