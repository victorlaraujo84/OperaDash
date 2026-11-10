import assert from "node:assert/strict";
import { filterByCategory, filterRecords, getAnnualAlarmVolume, getAvailability, getDefaultCategory, getDefaultMonth, rankItsmTicketsForAlarmPeriod } from "../src/lib/analytics";
import type { AlarmRecord, DashboardFilters, InventoryAsset, ItsmIncident } from "../src/types/operadora";

const filters: DashboardFilters = {
  month: "2025-09",
  from: "",
  to: "",
  operator: "",
  locality: "São Paulo",
  responsible: "",
  deviceType: "",
  sourceType: "",
  trap: "",
  itsmStatus: "",
  itsmResponsible: "",
  search: "",
};

function alarm(id: string, device: string, locality: string, durationMinutes: number): AlarmRecord {
  return {
    id,
    sourceRow: Number(id),
    alarm: "Interrupção de enlace",
    device,
    hasDeviceIdentifier: true,
    sourceType: "LINK",
    deviceType: "LINK",
    operator: "Operadora A",
    locality,
    responsible: "",
    trap: "",
    ticket: "",
    comment: "",
    startedAt: new Date(2025, 8, 2, 10, 0),
    endedAt: new Date(2025, 8, 2, 11, 0),
    durationMinutes,
    raw: {},
  };
}

function asset(id: string, name: string, locality: string | null, flags: Partial<Pick<InventoryAsset, "localityMissing" | "localityConflict" | "operatorMissing" | "operatorConflict">> = {}, operator = "Operadora A"): InventoryAsset {
  return { id, name, categories: ["links"], operator, operatorMissing: false, operatorConflict: false, locality, localityMissing: false, localityConflict: false, ...flags };
}

const mixedCategoryRecords = [
  { ...alarm("8", "LINK-OLD", "São Paulo", 40), startedAt: new Date(2025, 5, 20) },
  { ...alarm("9", "RTR-NEW", "São Paulo", 20), deviceType: "ROUTER", sourceType: "ROUTER", startedAt: new Date(2025, 8, 20) },
];
const defaultCategory = getDefaultCategory(mixedCategoryRecords);
assert.equal(defaultCategory, "links", "a categoria inicial é Links quando há alarmes de link no workbook");
assert.equal(getDefaultMonth(filterByCategory(mixedCategoryRecords, defaultCategory)), "2025-05", "o mês inicial deriva apenas das datas válidas da categoria ativa, não da categoria com o registro mais recente");

const records = [
  alarm("2", "LINK-SP-01", "SAO PAULO", 60),
  { ...alarm("3", "LINK-RJ-01", "Rio de Janeiro", 90), operator: "Operadora B" },
];
const filtered = filterRecords(records, filters);
assert.equal(filtered.length, 1, "filtro de cidade ignora diferenças de acento e caixa");

const inventory = [
  asset("LINK-SP-01", "LINK-SP-01", "São Paulo"),
  asset("LINK-SP-02", "LINK-SP-02", "SAO PAULO"),
  asset("LINK-RJ-01", "LINK-RJ-01", "Rio de Janeiro", {}, "Operadora B"),
];
const cityAvailability = getAvailability(filtered, filtered, filters, inventory, true);
assert.equal(cityAvailability.status, "available");
assert.equal(cityAvailability.monitoredAssets, 2, "o denominador considera os dois links da localidade, inclusive o sem alarme");
assert.equal(cityAvailability.hoursPerAsset, 720, "setembro tem 30 dias × 24 horas por ativo");
assert.equal(cityAvailability.totalHours, 1_440, "a base municipal usa 720 horas por link multiplicadas pelos links do inventário local");
assert.equal(cityAvailability.downtimeHours, 1, "o numerador usa a indisponibilidade do link conciliado na localidade");
assert.ok(Math.abs((cityAvailability.percent ?? 0) - (1_439 / 1_440) * 100) < 1e-9);

const operatorFilters = { ...filters, operator: "Operadora A" };
const operatorRecords = filterRecords(records, operatorFilters);
const operatorAvailability = getAvailability(operatorRecords, operatorRecords, operatorFilters, inventory, true, true);
assert.equal(operatorRecords.length, 1, "operadora reduz os alarmes considerados");
assert.equal(operatorAvailability.downtimeHours, 1, "a disponibilidade soma somente a indisponibilidade do recorte de operadora");
assert.equal(operatorAvailability.monitoredAssets, 2, "ativos monitorados sem alarmes continuam no denominador municipal");
const otherOperatorFilters = { ...filters, operator: "Operadora B", locality: "" };
const otherOperatorRecords = filterRecords(records, otherOperatorFilters);
const otherOperatorAvailability = getAvailability(otherOperatorRecords, otherOperatorRecords, otherOperatorFilters, inventory, true, true);
assert.equal(otherOperatorAvailability.monitoredAssets, 1, "a operadora selecionada reduz o denominador aos ativos monitorados daquela operadora");

const operatorWithoutAlarmInSelectedMonth = { ...operatorFilters, month: "2025-10" };
const operatorWithoutAlarmRecords = filterRecords(records, operatorWithoutAlarmInSelectedMonth);
const operatorWithoutAlarmAvailability = getAvailability(records, operatorWithoutAlarmRecords, operatorWithoutAlarmInSelectedMonth, inventory, true, true);
assert.equal(operatorWithoutAlarmRecords.length, 0, "o recorte pode não ter alarmes da operadora no mês selecionado");
assert.equal(operatorWithoutAlarmAvailability.status, "no-match", "o período continua definido pelo recorte da categoria, mesmo sem alarme da operadora");
assert.equal(operatorWithoutAlarmAvailability.monitoredAssets, 2, "a operadora continua mostrando seus ativos monitorados sem transformar o período em inválido");

const operatorScopedInventory = [
  ...inventory,
  asset("LINK-SEM-OPERADORA", "LINK-SEM-OPERADORA", "São Paulo", { operatorMissing: true }, ""),
];
const scopedOperatorAvailability = getAvailability(operatorRecords, operatorRecords, operatorFilters, operatorScopedInventory, true, true);
assert.equal(scopedOperatorAvailability.status, "available", "ativo sem operadora fora da seleção não bloqueia o percentual da operadora escolhida");

const unmapped = getAvailability(filtered, filtered, filters, inventory, false);
assert.equal(unmapped.status, "no-locality-column", "não calcula percentual municipal sem coluna de localidade no inventário");

const incomplete = getAvailability(filtered, filtered, filters, [
  ...inventory,
  asset("LINK-CIDADE-CONFLITANTE", "LINK-CIDADE-CONFLITANTE", "São Paulo", { localityMissing: true }),
], true);
assert.equal(incomplete.status, "incomplete-locality", "não apresenta percentual se algum ativo da localidade selecionada não puder ser atribuído com segurança");
assert.equal(incomplete.localityIssueAssets, 1);
assert.equal(incomplete.monitoredAssets, 3, "os cards mostram os ativos da localidade, sem publicar percentual parcial");
assert.equal(incomplete.percent, null);

const allCities = { ...filters, locality: "" };
const unfiltered = filterRecords(records, allCities);
const totalAvailability = getAvailability(unfiltered, unfiltered, allCities, inventory, false);
assert.equal(totalAvailability.status, "available", "o cálculo geral continua disponível mesmo sem coluna de cidade");
assert.equal(totalAvailability.monitoredAssets, 3, "o inventário global usa os três links únicos das localidades");
assert.equal(totalAvailability.totalHours, 2_160);

const probeTicket: ItsmIncident = {
  key: "INC-42",
  summary: "EDGE PROBE",
  responsible: "Ana Lima",
  status: "Resolvido",
  createdAt: null,
  updatedAt: null,
  dueAt: null,
  resolvedAt: null,
  internalLinks: [],
  sourceRow: 42,
};
const filterProbe: AlarmRecord = {
  ...alarm("42", "LINK-SP-01", "São Paulo", 60),
  alarm: "EDGE PROBE",
  operator: "Operadora Teste",
  responsible: "noc-solor",
  sourceType: "LINK-CORP",
  trap: "BGP",
  ticket: "INC-42",
  comment: "INC-42",
  itsmMatch: {
    status: "matched-key",
    matchField: "Chave da item",
    resolution: "unique-key",
    summaryCheck: "compatible",
    commentKeys: ["INC-42"],
    candidateKeys: ["INC-42"],
    ticket: probeTicket,
  },
};
const selectedFilters: DashboardFilters = {
  ...filters,
  from: "2025-09-02",
  to: "2025-09-02",
  operator: "Operadora Teste",
  responsible: "noc-solor",
  deviceType: "LINK",
  sourceType: "LINK-CORP",
  trap: "BGP",
  itsmStatus: "Resolvido",
  itsmResponsible: "Ana Lima",
  search: "inc-42",
};
const selectedRecords = filterRecords([filterProbe], selectedFilters);
assert.equal(selectedRecords.length, 1, "uma linha pode satisfazer simultaneamente período, operador, localidade, responsável, tipo, TIPO, trap, filtros ITSM e busca");
const selectedInventory = inventory.map((item) => ({ ...item, operator: "Operadora Teste" }));
const selectedAvailability = getAvailability(selectedRecords, selectedRecords, selectedFilters, selectedInventory, true, true);
assert.equal(selectedAvailability.status, "available");
assert.equal(selectedAvailability.hoursPerAsset, 24, "um intervalo de um dia selecionado resulta em 24 h por ativo");
assert.equal(selectedAvailability.downtimeHours, 1, "a disponibilidade recebe somente alarmes que passaram por todos os filtros selecionados");
assert.equal(selectedAvailability.monitoredAssets, 2, "o filtro de eventos não remove ativos monitorados sem alarmes do denominador");

for (const [key, value] of [
  ["month", "2025-10"],
  ["from", "2025-09-03"],
  ["to", "2025-09-01"],
  ["operator", "Outra operadora"],
  ["locality", "Outra cidade"],
  ["responsible", "Outro técnico"],
  ["deviceType", "ROUTER"],
  ["sourceType", "OUTRO"],
  ["trap", "ICMP"],
  ["itsmStatus", "Aberto"],
  ["itsmResponsible", "Outro responsável"],
  ["search", "não encontrado"],
] as [keyof DashboardFilters, string][]) {
  assert.equal(filterRecords([filterProbe], { ...selectedFilters, [key]: value }).length, 0, `o filtro ${key} precisa alterar o conjunto de cálculo`);
}

const noMatchFilters = { ...selectedFilters, search: "não encontrado" };
const noMatchRecords = filterRecords([filterProbe], noMatchFilters);
const noMatchAvailability = getAvailability(noMatchRecords, noMatchRecords, noMatchFilters, selectedInventory, true, true);
assert.equal(noMatchAvailability.status, "no-match", "um mês/dia selecionado sem linhas correspondentes não vira disponibilidade de 100%");
assert.equal(noMatchAvailability.percent, null);

const selectedTechnicians = rankItsmTicketsForAlarmPeriod([probeTicket], selectedRecords);
assert.equal(selectedTechnicians.uniqueTickets, 1, "o ranking ITSM recebe apenas tickets associados às linhas que passaram pelos filtros");
const selectedAnnualVolume = getAnnualAlarmVolume(selectedRecords, selectedRecords, 2025);
assert.deepEqual(selectedAnnualVolume.months.map((month) => [month.key, month.alarms]), [["2025-09", 1]], "a série anual recebe somente os alarmes filtrados");
const annualCoverage = [selectedRecords[0], { ...selectedRecords[0], id: "coverage-nov", startedAt: new Date(2025, 10, 8) }];
const annualVolumeWithFilteredZero = getAnnualAlarmVolume(selectedRecords, annualCoverage, 2025);
assert.deepEqual(annualVolumeWithFilteredZero.months.map((month) => [month.key, month.alarms]), [["2025-09", 1], ["2025-10", 0], ["2025-11", 0]], "meses internos cobertos sem registros que passem pelos filtros são exibidos como zero");

console.log("OK: filtros aplicados ao cálculo do recorte, disponibilidade municipal e zero resultados tratados sem percentual enganoso.");
