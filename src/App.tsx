import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { SolorShell, pageLabels, type SolorPage } from './components/SolorShell';
import { Overview } from './components/Overview';
import { SubtaskUploadPanel } from './components/SubtaskUploadPanel';
import { ItsmCorrelationPanel } from './components/ItsmCorrelationPanel';
import { ColumnMappingPanel } from './components/ColumnMappingPanel';
import { CompanyLogoSettings } from './components/CompanyLogoSettings';
import { SourceTemplates } from "./components/SourceTemplates";
import { alarmMappingFields, itsmMappingFields, subtaskMappingFields, type ColumnMapping } from './lib/column-mapping';
import type { inspectInputColumns } from './lib/csv-workbook';
import { getMonthlyHistory } from './lib/monthly-history';
import { correlateItsm } from './lib/itsm-correlation';
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  BrainCircuit,
  Boxes,
  CalendarDays,
  Cable,
  ChevronDown,
  ClipboardList,
  CircleHelp,
  Clock3,
  Database,
  FileSpreadsheet,
  FilterX,
  MapPin,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
  Signal,
  Users,
  X,
} from "lucide-react";
import { AlarmTable } from "./components/AlarmTable";
import { AlarmUploadPanel } from "./components/AlarmUploadPanel";
import { CategoryTabs } from "./components/CategoryTabs";
import { DaypartActuation } from "./components/DaypartActuation";
import { DataQualityPanel } from "./components/DataQualityPanel";
import { DetectedColumnsPanel } from "./components/DetectedColumnsPanel";
import { InventoryUploadPanel } from "./components/InventoryUploadPanel";
import { LocalityInventoryCards } from "./components/LocalityInventoryCards";
import { ItsmUploadPanel } from "./components/ItsmUploadPanel";
import { LocalAIAssistant } from "./components/LocalAIAssistant";
import { MetricCard } from "./components/MetricCard";
import { MtfbPanel } from "./components/MtfbPanel";
import { ItsmIndicatorsPanel } from "./components/ItsmIndicatorsPanel";
import { InventoryPanel } from "./components/InventoryPanel";
import { JiraSettings } from "./components/JiraSettings";
import { SharePointPublicFilePanel } from "./components/SharePointPublicFilePanel";
import {
  filterByCategory,
  filterByCategoryAll,
  filterRecords,
  filterRecordsByAlarmPeriod,
  getAvailability,
  formatHours,
  formatMinutes,
  formatNumber,
  formatPercent,
  getAcknowledgement,
  getAnnualAlarmVolume,
  getAvailableMonths,
  getAvailableYears,
  getDaypartActuation,
  getDefaultCategory,
  getDefaultMonth,
  getDowntime,
  getMttr,
  getMtfbByOperatorLocality,
  getMtfbSummary,
  getFlappingRows,
  getNetDowntime,
  monthLabel,
  monthKey,
  normalizeLocalityKey,
  rankBy,
  rankByIncidentCount,
  rankItsmTicketsForAlarmPeriod,
  uniqueValues,
} from "./lib/analytics";
import { getItsmOperationalSummary } from "./lib/itsm-indicators";
import { getInventoryOperationalSummary } from "./lib/inventory-indicators";
import { getMonthComparison } from "./lib/month-comparison";
import { extractIssueKeys, getItsmJoinSummary, itsmMatchLabel, joinAlarmsWithItsm } from "./lib/itsm-join";
import type { AlarmCategory, AlarmRecord, DashboardFilters, DetectedColumn, ImportResult, InventoryAsset, InventoryImportResult, ItsmImportResult } from "./types/operadora";
import type { LocalAiCategorySnapshot, LocalAiDashboardContext } from "./types/local-ai";
import { DEFAULT_JIRA_ISSUES_URL } from "./lib/jira";
import * as localDocuments from "./lib/import-storage";

const RankChart = lazy(() => import("./components/RankChart").then(({ RankChart: Chart }) => ({ default: Chart })));
const AnnualVolumeChart = lazy(() => import("./components/AnnualVolumeChart").then(({ AnnualVolumeChart: Chart }) => ({ default: Chart })));

const emptyFilters = (month = "all"): DashboardFilters => ({
  month,
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
});

function optionLabel(value: string): string {
  return value.length > 45 ? `${value.slice(0, 42)}…` : value;
}

function formatSourceRows(rows: number[]): string {
  const ordered = [...new Set(rows)].sort((a, b) => a - b);
  if (!ordered.length) return "—";
  const ranges: string[] = [];
  let start = ordered[0];
  let end = ordered[0];
  for (const row of ordered.slice(1)) {
    if (row === end + 1) {
      end = row;
      continue;
    }
    ranges.push(start === end ? String(start) : `${start}–${end}`);
    start = row;
    end = row;
  }
  ranges.push(start === end ? String(start) : `${start}–${end}`);
  return ranges.join(", ");
}

function SelectField({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return (
    <label className="filter-field">
      <span>{label}</span>
      <span className="select-wrap">
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Todas</option>
          {values.map((item) => <option key={item} value={item}>{optionLabel(item)}</option>)}
        </select>
        <ChevronDown size={14} aria-hidden="true" />
      </span>
    </label>
  );
}

function exportCsv(rows: AlarmRecord[], category: AlarmCategory) {
  const columns: [string, (row: AlarmRecord) => string][] = [
    ["Alarme", (row) => row.alarm],
    ["Dispositivo", (row) => row.device],
    ["TIPO", (row) => row.sourceType],
    ["Operadora", (row) => row.operator],
    ["Localidade", (row) => row.locality],
    ["Responsável do alarme", (row) => row.responsible],
    ["Horário Inicial", (row) => row.startedAt?.toLocaleString("pt-BR") ?? ""],
    ["Horário Final", (row) => row.endedAt?.toLocaleString("pt-BR") ?? ""],
    ["DuracaoMinutos", (row) => row.durationMinutes === null ? "" : String(row.durationMinutes)],
    ["Classificação", (row) => row.classification ?? "Não classificado"],
    ["Comentário", (row) => row.comment],
    ["ITSM Vínculo", (row) => itsmMatchLabel(row.itsmMatch)],
    ["ITSM Método", (row) => row.itsmMatch?.matchField ?? ""],
    ["ITSM Chave", (row) => row.itsmMatch?.ticket?.key ?? ""],
    ["ITSM Chaves candidatas", (row) => row.itsmMatch?.candidateKeys.join(", ") ?? ""],
    ["ITSM Chaves no Comentário", (row) => row.itsmMatch?.commentKeys.join(", ") ?? ""],
    ["ITSM Conferência Dispositivo × Resumo", (row) => row.itsmMatch?.summaryCheck === "compatible" ? "Compatível" : row.itsmMatch?.summaryCheck === "different" ? "Divergente" : "Não conferido"],
    ["ITSM Resumo", (row) => row.itsmMatch?.ticket?.summary ?? ""],
    ["ITSM Motivo", (row) => row.itsmMatch?.ticket?.reason ?? ""],
    ["ITSM Tipo de item", (row) => row.itsmMatch?.ticket?.itemType ?? ""],
    ["ITSM Responsável", (row) => row.itsmMatch?.ticket?.responsible ?? ""],
    ["ITSM Status", (row) => row.itsmMatch?.ticket?.status ?? ""],
    ["ITSM LinkInterno-1", (row) => row.itsmMatch?.ticket?.internalLinks.find((link) => link.field === "LinkInterno-1")?.value ?? ""],
    ["ITSM LinkInterno-2", (row) => row.itsmMatch?.ticket?.internalLinks.find((link) => link.field === "LinkInterno-2")?.value ?? ""],
    ["ITSM Criado", (row) => row.itsmMatch?.ticket?.createdAt?.toLocaleString("pt-BR") ?? ""],
    ["ITSM Atualizado(a)", (row) => row.itsmMatch?.ticket?.updatedAt?.toLocaleString("pt-BR") ?? ""],
    ["ITSM Data limite", (row) => row.itsmMatch?.ticket?.dueAt?.toLocaleString("pt-BR") ?? ""],
    ["ITSM Resolvido", (row) => row.itsmMatch?.ticket?.resolvedAt?.toLocaleString("pt-BR") ?? ""],
  ];
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const contents = [columns.map(([heading]) => escape(heading)).join(";"), ...rows.map((row) => columns.map(([, getValue]) => escape(String(getValue(row) ?? ""))).join(";"))].join("\r\n");
  const blob = new Blob(["\ufeff", contents], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = category === "links" ? "alarmes-links-filtrados.csv" : "alarmes-dispositivos-filtrados.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export default function App({ documents = localDocuments, readOnly = false, canUseAi = true }: { documents?: typeof localDocuments; readOnly?: boolean; canUseAi?: boolean }) {
  const { loadImportedDocument, removeImportedDocument, saveImportedDocument } = documents;
  const [page, setPage] = useState<SolorPage>('overview');
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [companyLogo, setCompanyLogo] = useState(() => { try { return localStorage.getItem('operadash:company-logo') ?? ''; } catch { return ''; } });
  const [logoScale, setLogoScale] = useState(() => {
    try {
      const saved = Number(localStorage.getItem('operadash:company-logo-scale'));
      return saved >= 50 && saved <= 100 ? saved : 100;
    } catch { return 100; }
  });
  const [alarmPreview, setAlarmPreview] = useState<ReturnType<typeof inspectInputColumns> | null>(null);
  const [subtaskFile, setSubtaskFile] = useState<File | null>(null);
  const [subtaskData, setSubtaskData] = useState<ItsmImportResult | null>(null);
  const [subtaskBusy, setSubtaskBusy] = useState(false);
  const [subtaskError, setSubtaskError] = useState('');
  const subtaskInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itsmInputRef = useRef<HTMLInputElement>(null);
  const inventoryInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<ImportResult | null>(null);
  const [itsmData, setItsmData] = useState<ItsmImportResult | null>(null);
  const [itsmFile, setItsmFile] = useState<File | null>(null);
  const [inventoryFile, setInventoryFile] = useState<File | null>(null);
  const [inventoryData, setInventoryData] = useState<InventoryImportResult | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>(emptyFilters());
  const [busy, setBusy] = useState(false);
  const [itsmBusy, setItsmBusy] = useState(false);
  const [inventoryBusy, setInventoryBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [itsmError, setItsmError] = useState("");
  const [inventoryError, setInventoryError] = useState("");
  const [showMethod, setShowMethod] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AlarmCategory>("links");
  const [activeView, setActiveView] = useState<"operational" | "itsm" | "inventory" | "ai">("operational");
  const [chartYear, setChartYear] = useState<number | null>(null);
  const restoreDocumentsStarted = useRef(false);
  const [jiraBaseUrl, setJiraBaseUrl] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_JIRA_ISSUES_URL;
    return window.localStorage.getItem("operadash:jira-issues-url") || DEFAULT_JIRA_ISSUES_URL;
  });
  const extensionEnvironment = typeof chrome !== "undefined" && Boolean(chrome.runtime?.id && chrome.permissions?.request);

  const navigate = (next: SolorPage) => {
    if ((readOnly && next === 'sources') || (!canUseAi && next === 'ai')) return;
    setPage(next);
    setSidebarOpen(next === 'sources');
    if (next === 'links' || next === 'devices') {
      setActiveTab(next === 'links' ? 'links' : 'devices');
      setActiveView('operational');
      setFilters(current => ({ ...current, sourceType: '' }));
    }
    window.scrollTo({ top: 0 });
  };

  const processSubtasks = async (nextFile: File, requestedSheet?: string, mapping?: ColumnMapping, restoring = false) => {
    setSubtaskBusy(true); setSubtaskError('');
    try {
      if (!/\.(csv|xlsx)$/i.test(nextFile.name)) throw new Error('Selecione um CSV ou XLSX de subtarefas.');
      const buffer = await nextFile.arrayBuffer();
      const { parseItsmWorkbook } = await import('./lib/itsm-parser');
      const parsed = parseItsmWorkbook(buffer, nextFile.name, requestedSheet, mapping);
      if (!restoring) await saveImportedDocument({ key: 'subtasks', name: nextFile.name, buffer, sheetName: parsed.sheetName, options: { columnMapping: mapping } });
      setSubtaskFile(nextFile);
      setSubtaskData(parsed);

    } catch (cause) { setSubtaskError(cause instanceof Error ? cause.message : 'Não foi possível ler as subtarefas.'); }
    finally { setSubtaskBusy(false); }
  };

  useEffect(() => {
    window.localStorage.setItem("operadash:jira-issues-url", jiraBaseUrl);
  }, [jiraBaseUrl]);

  const processFile = async (nextFile: File, requestedSheet?: string, mapping?: ColumnMapping, restoring = false) => {
    const remapping = data !== null && file === nextFile && mapping !== undefined;
    if (!remapping) { setData(null); setFile(null); setFilters(emptyFilters()); }
    setAlarmPreview(null);
    setShowMethod(false);
    setError("");
    if (!/\.(csv|xlsx)$/i.test(nextFile.name)) {
      setError("Selecione um arquivo CSV ou XLSX para iniciar a análise.");
      return;
    }
    if (nextFile.size === 0) {
      setError("O arquivo está vazio. Selecione uma planilha Excel válida.");
      return;
    }
    setBusy(true);
    try {
      const buffer = await nextFile.arrayBuffer();
      setFile(nextFile);
      const { parseWorkbook } = await import("./lib/xlsx-parser");
      const parsed = parseWorkbook(buffer, nextFile.name, requestedSheet, mapping);
      const initialCategory = getDefaultCategory(parsed.records);
      const initialCategoryRecords = filterByCategory(parsed.records, initialCategory);
      if (!restoring) await saveImportedDocument({ key: "alarms", name: nextFile.name, buffer, sheetName: parsed.sheetName, options: { columnMapping: mapping } });
      setFile(nextFile);
      setData(parsed);

      if (!remapping) { setFilters(emptyFilters(getDefaultMonth(initialCategoryRecords))); setActiveTab(initialCategory); }
      setActiveView("operational");
      setChartYear(getAvailableYears(initialCategoryRecords)[0] ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível ler esta planilha.");
      try { const { inspectInputColumns } = await import('./lib/csv-workbook'); setAlarmPreview(inspectInputColumns(await nextFile.arrayBuffer(), nextFile.name, requestedSheet)); setFile(nextFile); } catch { /* Malformed files remain rejected. */ }
    } finally {
      setBusy(false);
    }
  };

  const processItsmFile = async (nextFile: File, requestedSheet?: string, mapping?: ColumnMapping, restoring = false) => {
    if (!mapping) setItsmData(null);
    setItsmError("");
    if (nextFile !== itsmFile) setFilters((current) => ({ ...current, itsmStatus: "", itsmResponsible: "" }));
    if (!/\.(csv|xlsx)$/i.test(nextFile.name)) {
      setItsmError("Selecione um CSV ou XLSX de incidentes.");
      return;
    }
    if (nextFile.size === 0) {
      setItsmError("O arquivo ITSM está vazio.");
      return;
    }
    setItsmBusy(true);
    try {
      const buffer = await nextFile.arrayBuffer();
      const { parseItsmWorkbook } = await import("./lib/itsm-parser");
      const parsed = parseItsmWorkbook(buffer, nextFile.name, requestedSheet, mapping);
      if (!restoring) await saveImportedDocument({ key: "itsm", name: nextFile.name, buffer, sheetName: parsed.sheetName, options: { columnMapping: mapping } });
      setItsmFile(nextFile);
      setItsmData(parsed);

    } catch (cause) {
      setItsmError(cause instanceof Error ? cause.message : "Não foi possível ler a planilha ITSM.");
    } finally {
      setItsmBusy(false);
    }
  };

  const processInventoryFile = async (nextFile: File, requestedSheet?: string, requestedHostColumn?: number, requestedCategoryColumn?: number | null, requestedLocalityColumn?: number | null, requestedOperatorColumn?: number | null, restoring = false) => {
    const replacingFile = nextFile !== inventoryFile;
    if (replacingFile) {
      setInventoryFile(null);
      setInventoryData(null);
    }
    setInventoryError("");
    if (!/\.(csv|xlsx)$/i.test(nextFile.name)) {
      setInventoryError("Selecione um inventário CSV ou XLSX.");
      return;
    }
    if (nextFile.size === 0) {
      setInventoryError("O inventário de hosts está vazio.");
      return;
    }
    setInventoryBusy(true);
    try {
      const buffer = await nextFile.arrayBuffer();
      const { parseInventoryWorkbook } = await import("./lib/inventory-parser");
      const parsed = parseInventoryWorkbook(buffer, nextFile.name, requestedSheet, requestedHostColumn, requestedCategoryColumn, requestedLocalityColumn, requestedOperatorColumn);
      if (!restoring) await saveImportedDocument({ key: "inventory", name: nextFile.name, buffer, sheetName: parsed.sheetName, options: { hostColumnIndex: parsed.hostColumnIndex, categoryColumnIndex: parsed.categoryColumnIndex, localityColumnIndex: parsed.localityColumnIndex, operatorColumnIndex: parsed.operatorColumnIndex } });
      setInventoryFile(nextFile);
      setInventoryData(parsed);

    } catch (cause) {
      setInventoryError(cause instanceof Error ? cause.message : "Não foi possível ler o inventário de hosts.");
    } finally {
      setInventoryBusy(false);
    }
  };

  const onFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    if (nextFile) void processFile(nextFile);
    event.target.value = "";
  };

  const onItsmFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    if (nextFile) void processItsmFile(nextFile);
    event.target.value = "";
  };

  const onInventoryFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    if (nextFile) void processInventoryFile(nextFile);
    event.target.value = "";
  };

  useEffect(() => {
    if (restoreDocumentsStarted.current) return;
    restoreDocumentsStarted.current = true;
    const restore = async () => {
      try {
        const [alarmDocument, itsmDocument, inventoryDocument, subtaskDocument] = await Promise.all([
          loadImportedDocument("alarms"),
          loadImportedDocument("itsm"),
          loadImportedDocument("inventory"),
          loadImportedDocument("subtasks"),
        ]);
        const toFile = (document: { buffer: ArrayBuffer; name: string }) => new File([document.buffer], document.name, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        if (subtaskDocument) void processSubtasks(toFile(subtaskDocument), subtaskDocument.sheetName, subtaskDocument.options?.columnMapping, true);
        if (alarmDocument) void processFile(toFile(alarmDocument), alarmDocument.sheetName, alarmDocument.options?.columnMapping, true);
        if (itsmDocument) void processItsmFile(toFile(itsmDocument), itsmDocument.sheetName, itsmDocument.options?.columnMapping, true);
        if (inventoryDocument) void processInventoryFile(toFile(inventoryDocument), inventoryDocument.sheetName, inventoryDocument.options?.hostColumnIndex ?? undefined, inventoryDocument.options?.categoryColumnIndex, inventoryDocument.options?.localityColumnIndex, inventoryDocument.options?.operatorColumnIndex, true);
      } catch {
        setError("Os documentos anteriores não puderam ser restaurados. Importe-os novamente para continuar.");
      }
    };
    void restore();
  }, []);

  const sourceRecords = data?.records ?? [];
  const records = useMemo(
    () => itsmData ? joinAlarmsWithItsm(sourceRecords, itsmData.records) : sourceRecords.map((record) => ({ ...record, itsmMatch: null })),
    [sourceRecords, itsmData],
  );
  const itsmSummary = useMemo(() => itsmData ? getItsmJoinSummary(records) : null, [itsmData, records]);
  const linkRecords = useMemo(() => filterByCategory(records, "links"), [records]);
  const deviceRecords = useMemo(() => filterByCategory(records, "devices"), [records]);
  const linkRecordsAll = useMemo(() => filterByCategoryAll(records, "links"), [records]);
  const deviceRecordsAll = useMemo(() => filterByCategoryAll(records, "devices"), [records]);
  const inventoryAssets = useMemo<InventoryAsset[] | null>(() => inventoryData ? inventoryData.assets.filter((asset) => asset.categories.includes(activeTab)) : null, [inventoryData, activeTab]);
  const inventoryDetectedColumns = useMemo<DetectedColumn[]>(() => {
    if (!inventoryData) return [];
    const fields = new Map<number, string>();
    if (inventoryData.hostColumnIndex !== null) fields.set(inventoryData.hostColumnIndex, "Host / ativo");
    if (inventoryData.categoryColumnIndex !== null) fields.set(inventoryData.categoryColumnIndex, "Tipo / categoria");
    if (inventoryData.operatorColumnIndex !== null) fields.set(inventoryData.operatorColumnIndex, "Operadora");
    if (inventoryData.localityColumnIndex !== null) fields.set(inventoryData.localityColumnIndex, "Localidade");
    return inventoryData.columns.map((column) => ({ column: column.label, field: fields.get(column.index) ?? null }));
  }, [inventoryData]);
  const localityInventoryAssets = useMemo(() => inventoryData && filters.locality
    ? inventoryData.assets.filter((asset) => asset.categories.includes(activeTab) && asset.locality && normalizeLocalityKey(asset.locality) === normalizeLocalityKey(filters.locality))
    : [], [inventoryData, activeTab, filters.locality]);
  const categoryRecords = activeTab === "links" ? linkRecords : deviceRecords;
  const categoryRecordsAll = activeTab === "links" ? linkRecordsAll : deviceRecordsAll;
  const allInventoryAssets = useMemo(() => inventoryData?.assets ?? [], [inventoryData]);
  const chartScopeRecords = useMemo(() => filterRecords(categoryRecords, { ...filters, month: "all", from: "", to: "" }), [categoryRecords, filters]);
  const months = useMemo(() => getAvailableMonths(chartScopeRecords), [chartScopeRecords]);
  const availableYears = useMemo(() => getAvailableYears(chartScopeRecords), [chartScopeRecords]);
  const periodYear = useMemo(() => {
    if (filters.month !== "all") {
      const year = Number(filters.month.slice(0, 4));
      return Number.isInteger(year) && year > 0 ? year : null;
    }
    if (filters.from && filters.to && filters.from.slice(0, 4) === filters.to.slice(0, 4)) {
      const year = Number(filters.from.slice(0, 4));
      return Number.isInteger(year) && year > 0 ? year : null;
    }
    return null;
  }, [filters.month, filters.from, filters.to]);
  const years = periodYear === null ? availableYears : [periodYear];
  const yearPinned = periodYear !== null;
  const selectedYear = periodYear ?? (chartYear !== null && availableYears.includes(chartYear) ? chartYear : availableYears[0] ?? new Date().getFullYear());
  const monthOptions = useMemo(() => {
    const options = new Set(page === "itsm" || page === "inventory" ? getAvailableMonths(records) : months);
    if (page === "itsm") {
      for (const ticket of [...(itsmData?.records ?? []), ...(subtaskData?.records ?? [])]) {
        if (ticket.createdAt && !Number.isNaN(ticket.createdAt.getTime())) options.add(monthKey(ticket.createdAt));
      }
    }
    if (filters.month !== "all") options.add(filters.month);
    return [...options].sort((a, b) => b.localeCompare(a));
  }, [months, filters.month, records, page, itsmData, subtaskData]);
  const itsmLatestMonth = useMemo(() => [
    ...getAvailableMonths(records),
    ...(itsmData?.records ?? []).flatMap(ticket => ticket.createdAt && !Number.isNaN(ticket.createdAt.getTime()) ? [monthKey(ticket.createdAt)] : []),
    ...(subtaskData?.records ?? []).flatMap(ticket => ticket.createdAt && !Number.isNaN(ticket.createdAt.getTime()) ? [monthKey(ticket.createdAt)] : []),
  ].sort().at(-1), [records, itsmData, subtaskData]);
  const quickMonth = page === "itsm"
    ? itsmLatestMonth ? monthKey(new Date(Number(itsmLatestMonth.slice(0, 4)), Number(itsmLatestMonth.slice(5)) - 2, 1)) : "all"
    : getDefaultMonth(chartScopeRecords);
  const availableFilters = useMemo(() => {
    const localityOptions = new Map<string, string>();
    const inventoryLocalities = inventoryData?.assets.filter((asset) => asset.categories.includes(activeTab)).flatMap((asset) => asset.locality ? [asset.locality] : []) ?? [];
    for (const locality of [...uniqueValues(records, "locality"), ...inventoryLocalities]) {
      const key = normalizeLocalityKey(locality);
      if (key && !localityOptions.has(key)) localityOptions.set(key, locality.trim());
    }
    return {
      operators: uniqueValues(records, "operator"),
      localities: [...localityOptions.values()].sort((a, b) => a.localeCompare(b, "pt-BR")),
      responsibles: uniqueValues(records, "responsible"),
      deviceTypes: uniqueValues(records, "deviceType").filter((item) => item !== "Não informada"),
      sourceTypes: uniqueValues(page === "itsm" ? records : categoryRecords, "sourceType"),
      traps: uniqueValues(records, "trap").filter((item) => item !== "Não informada"),
      itsmStatuses: [...new Set((itsmData?.records ?? []).flatMap(record => record.status ? [record.status] : []))].sort((a, b) => a.localeCompare(b, "pt-BR")),
      itsmResponsibles: [...new Set((itsmData?.records ?? []).flatMap(record => record.responsible ? [record.responsible] : []))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    };
  }, [records, categoryRecords, inventoryData, activeTab, page, itsmData]);
  const filtered = useMemo(() => filterRecords(categoryRecords, filters), [categoryRecords, filters]);
  const monthComparison = useMemo(() => getMonthComparison(filters), [filters]);
  const comparisonLabel = monthComparison?.previousLabel ?? null;
  const previousFiltered = useMemo(() => monthComparison ? filterRecords(categoryRecords, monthComparison.previousFilters) : [], [categoryRecords, monthComparison]);
  const previousCoverageRecords = useMemo(() => monthComparison ? filterRecordsByAlarmPeriod(categoryRecords, monthComparison.previousFilters) : [], [categoryRecords, monthComparison]);
  const currentDatedRecords = useMemo(() => filtered.filter((record) => record.startedAt && !Number.isNaN(record.startedAt.getTime())), [filtered]);
  const previousDatedRecords = useMemo(() => previousFiltered.filter((record) => record.startedAt && !Number.isNaN(record.startedAt.getTime())), [previousFiltered]);
  const comparisonHasBaseline = Boolean(monthComparison && previousCoverageRecords.length > 0);
  const annualCoverageRecords = useMemo(() => filterRecordsByAlarmPeriod(chartScopeRecords, filters), [chartScopeRecords, filters]);
  const annualVolume = useMemo(() => getAnnualAlarmVolume(filtered, annualCoverageRecords, selectedYear), [filtered, annualCoverageRecords, selectedYear]);
  const monthlyHistory = useMemo(() => getMonthlyHistory(categoryRecords, filters, selectedYear), [categoryRecords, filters, selectedYear]);
  const dayparts = useMemo(() => getDaypartActuation(filtered), [filtered]);
  const previousDayparts = useMemo(() => getDaypartActuation(previousFiltered).rows, [previousFiltered]);
  const mttr = useMemo(() => getMttr(filtered), [filtered]);
  const mtfbRows = useMemo(() => getMtfbByOperatorLocality(filtered), [filtered]);
  const mtfbSummary = useMemo(() => getMtfbSummary(mtfbRows), [mtfbRows]);
  const itsmIndicators = useMemo(() => getItsmOperationalSummary(filterRecords(categoryRecordsAll, filters)), [categoryRecordsAll, filters]);
  const inventorySummary = useMemo(() => getInventoryOperationalSummary(
    allInventoryAssets,
    records,
    filters,
    Boolean(inventoryData && inventoryData.localityColumnIndex !== null),
    Boolean(inventoryData && inventoryData.operatorColumnIndex !== null),
  ), [allInventoryAssets, records, filters, inventoryData]);
  const acknowledgement = useMemo(() => getAcknowledgement(filtered), [filtered]);
  const downtime = useMemo(() => getDowntime(filtered), [filtered]);
  const availability = useMemo(() => getAvailability(categoryRecords, filtered, filters, inventoryAssets, Boolean(inventoryData && inventoryData.localityColumnIndex !== null), Boolean(inventoryData && inventoryData.operatorColumnIndex !== null)), [categoryRecords, filtered, filters, inventoryAssets, inventoryData]);
  const availabilityDetail = availability.status === "available"
    ? `${formatNumber(availability.monitoredAssets)} ${activeTab === "links" ? "links" : "hosts"}${filters.locality ? ` em ${filters.locality}` : " no inventário"} × ${formatHours(availability.hoursPerAsset)} h/ativo = ${formatHours(availability.totalHours)} h-ativo`
    : availability.status === "no-operator-column"
      ? "Mapeie a coluna de operadora do inventário para calcular esta operadora"
      : availability.status === "incomplete-operator"
        ? `${formatNumber(availability.operatorIssueAssets)} ativos sem operadora única; percentual oculto para evitar subcontagem`
        : availability.status === "no-operator-assets"
          ? `Nenhum ${activeTab === "links" ? "link" : "host"} no inventário para ${filters.operator}`
          : availability.status === "no-locality-column"
      ? "Mapeie a coluna de localidade do inventário para calcular esta cidade"
      : availability.status === "incomplete-locality"
        ? `${formatNumber(availability.monitoredAssets)} ativos identificados em ${filters.locality}; complete as localidades de ${formatNumber(availability.localityIssueAssets)} ativo(s)`
        : availability.status === "no-locality-assets"
          ? `Nenhum ${activeTab === "links" ? "link" : "host"} no inventário para ${filters.locality}`
          : availability.status === "exceeds-period"
            ? "A indisponibilidade supera as horas-ativo do período"
            : availability.status === "no-inventory"
              ? "Importe o XLSX do inventário de hosts"
              : availability.status === "no-assets"
                ? `O inventário não tem ${activeTab === "links" ? "links" : "hosts"} nesta categoria`
                : availability.status === "no-match"
                  ? "Nenhum alarme com data e host válidos atende aos filtros e ao inventário"
                  : "Sem data válida nos alarmes para definir o período";
  const availabilityFootnote = availability.status === "available"
    ? `${formatHours(availability.availableHours)} h-ativo disponíveis · ${formatMinutes(availability.downtimeHours * 60, true)} indisponíveis${availability.unmatchedAssets.length ? ` · ${formatNumber(availability.unmatchedAssets.length)} host(s) sem correspondência` : ""}${availability.excludedRecords ? ` · ${formatNumber(availability.excludedRecords)} linha(s) sem data/host ignorada(s)` : ""}`
    : availability.status === "exceeds-period"
      ? "Confira o inventário, sobreposições ou alarmes repetidos"
    : availability.status === "no-operator-column"
      ? "Selecione a coluna que identifica a operadora dos hosts/links"
      : availability.status === "incomplete-operator"
        ? "Revise os ativos sem operadora ou com mais de uma operadora"
        : availability.status === "no-operator-assets"
          ? "Confira a operadora selecionada, a categoria ativa e o inventário"
          : availability.status === "no-locality-column"
      ? "Selecione a coluna que identifica a cidade dos hosts/links"
        : availability.status === "incomplete-locality"
          ? `${formatNumber(availability.localityIssueAssets)} ativo(s) sem localidade única; percentual oculto para evitar subcontagem`
          : availability.status === "no-locality-assets"
            ? "Confira a cidade selecionada, a categoria ativa e o inventário"
            : availability.status === "no-inventory"
              ? "O percentual depende do inventário carregado"
              : availability.status === "no-assets"
                ? "Confira a coluna de tipo ou a classificação do inventário"
                : availability.status === "no-match"
                  ? availability.unmatchedAssets.length
                    ? `${formatNumber(availability.unmatchedAssets.length)} host(s) fora do inventário; abra a revisão abaixo`
                    : "Nenhum alarme corresponde a todos os filtros; disponibilidade não calculada"
                  : "Horário Inicial válido necessário para atribuir o período";
  const availabilityExcludedGroups = useMemo(() => {
    const grouped = new Map<string, number[]>();
    for (const issue of availability.excludedRows) {
      const rows = grouped.get(issue.reason) ?? [];
      rows.push(issue.sourceRow);
      grouped.set(issue.reason, rows);
    }
    return [...grouped.entries()];
  }, [availability.excludedRows]);
  const technicianTickets = useMemo(() => rankItsmTicketsForAlarmPeriod(itsmData?.records ?? [], currentDatedRecords), [itsmData, currentDatedRecords]);
  const currentTechnicianComparison = useMemo(() => rankItsmTicketsForAlarmPeriod(itsmData?.records ?? [], currentDatedRecords, Number.MAX_SAFE_INTEGER), [itsmData, currentDatedRecords]);
  const previousTechnicianTickets = useMemo(() => rankItsmTicketsForAlarmPeriod(itsmData?.records ?? [], previousDatedRecords, Number.MAX_SAFE_INTEGER), [itsmData, previousDatedRecords]);
  const technicianComparisonHasBaseline = comparisonHasBaseline;
  const technicianTicketFootnote = !data
    ? "Importe a planilha de alarmes para definir o período do ranking."
    : currentDatedRecords.length === 0
      ? `Sem alarmes com Horário Inicial que atendam aos filtros selecionados; ajuste o recorte. ${formatNumber(technicianTickets.missingKeyRows)} tickets ITSM sem chave ignorados.`
      : `${formatNumber(technicianTickets.uniqueTickets)} tickets únicos no período · ${formatNumber(technicianTickets.duplicateRows)} linhas ITSM duplicadas consolidadas · ${formatNumber(technicianTickets.unmatchedAlarmRows)} alarmes sem match ITSM único · ${formatNumber(technicianTickets.missingKeyRows)} tickets sem chave · ${formatNumber(technicianTickets.unassignedTickets)} sem responsável`;
  const linkRanking = useMemo(() => rankBy(filtered, (record) => record.device), [filtered]);
  const localityRanking = useMemo(() => rankBy(filtered, (record) => record.locality), [filtered]);
  const operatorDowntime = useMemo(() => rankBy(filtered, (record) => record.operator), [filtered]);
  const operatorIncidents = useMemo(() => rankByIncidentCount(filtered, (record) => record.operator), [filtered]);
  const currentLinkComparison = useMemo(() => rankBy(filtered, (record) => record.device, filtered.length), [filtered]);
  const currentLocalityComparison = useMemo(() => rankBy(filtered, (record) => record.locality, filtered.length), [filtered]);
  const currentOperatorDowntime = useMemo(() => rankBy(filtered, (record) => record.operator, filtered.length), [filtered]);
  const currentOperatorIncidents = useMemo(() => rankByIncidentCount(filtered, (record) => record.operator, filtered.length), [filtered]);
  const previousLinkRanking = useMemo(() => rankBy(previousFiltered, (record) => record.device, previousFiltered.length), [previousFiltered]);
  const previousLocalityRanking = useMemo(() => rankBy(previousFiltered, (record) => record.locality, previousFiltered.length), [previousFiltered]);
  const previousOperatorDowntime = useMemo(() => rankBy(previousFiltered, (record) => record.operator, previousFiltered.length), [previousFiltered]);
  const previousOperatorIncidents = useMemo(() => rankByIncidentCount(previousFiltered, (record) => record.operator, previousFiltered.length), [previousFiltered]);

  const updateFilter = (key: keyof DashboardFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const resetFilters = () => setFilters(emptyFilters(data ? getDefaultMonth(chartScopeRecords) : "all"));
  const removeItsm = async () => {
    try { await removeImportedDocument("itsm"); } catch (cause) { setItsmError(cause instanceof Error ? cause.message : "Não foi possível remover os incidentes."); return; }
    setItsmData(null);
    setItsmFile(null);
    setItsmError("");
    
    setFilters((current) => ({ ...current, itsmStatus: "", itsmResponsible: "" }));
  };
  const removeInventory = async () => {
    try { await removeImportedDocument("inventory"); } catch (cause) { setInventoryError(cause instanceof Error ? cause.message : "Não foi possível remover o inventário."); return; }
    setInventoryData(null);
    setInventoryFile(null);
    setInventoryError("");
    
  };

  const monthTitle = filters.month === "all" ? "Todos os meses" : monthLabel(filters.month);
  const dateRangeError = filters.from && filters.to && filters.from > filters.to;
  const localAiContext = useMemo<LocalAiDashboardContext>(() => {
    const snapshot = (allRecords: AlarmRecord[], allRecordsIncludingOscillations: AlarmRecord[], categoryInventory: InventoryAsset[] | null): LocalAiCategorySnapshot => {
      const categoryFiltered = filterRecords(allRecords, filters);
      const oscillations = filterRecords(allRecordsIncludingOscillations, filters).filter((record) => record.durationMinutes !== null && record.durationMinutes < 40);
      const categoryAvailability = getAvailability(allRecords, categoryFiltered, filters, categoryInventory, Boolean(inventoryData && inventoryData.localityColumnIndex !== null), Boolean(inventoryData && inventoryData.operatorColumnIndex !== null));
      const categoryMttr = getMttr(categoryFiltered);
      const categoryMtfb = getMtfbByOperatorLocality(categoryFiltered);
      const categoryNet = getNetDowntime(categoryFiltered);
      return {
        alarmRows: categoryFiltered.length,
        downtimeHours: Number((getDowntime(categoryFiltered) / 60).toFixed(2)),
        netDowntimeHours: Number((categoryNet.netMinutes / 60).toFixed(2)),
        overlapHours: Number((categoryNet.overlapMinutes / 60).toFixed(2)),
        availabilityPercent: categoryAvailability.percent,
        monitoredAssets: categoryAvailability.monitoredAssets,
        totalAssetHours: categoryAvailability.totalHours,
        mttrMinutes: categoryMttr.minutes === null ? null : Number(categoryMttr.minutes.toFixed(2)),
        topAssets: rankBy(categoryFiltered, (record) => record.device, categoryFiltered.length).slice(0, 5).map((row) => ({ name: row.name, alarms: row.alarms, downtimeHours: Number((row.downtimeMinutes / 60).toFixed(2)) })),
        topOperators: rankBy(categoryFiltered, (record) => record.operator, categoryFiltered.length).slice(0, 5).map((row) => ({ name: row.name, alarms: row.alarms, downtimeHours: Number((row.downtimeMinutes / 60).toFixed(2)) })),
        flapping: getFlappingRows(oscillations).map((row) => ({ name: row.name, oscillationsInWindow: row.windowCount, totalMinutes: Number(row.downtimeMinutes.toFixed(2)), frequencyPerHour: Number(row.frequencyPerHour.toFixed(2)) })),
        mtfbByOperatorLocality: categoryMtfb.slice(0, 10).map((row) => ({ operator: row.operator, locality: row.locality, failures: row.failures, intervals: row.intervals, mtfbMinutes: row.mtfbMinutes === null ? null : Number(row.mtfbMinutes.toFixed(2)), medianMinutes: row.medianMinutes === null ? null : Number(row.medianMinutes.toFixed(2)), quality: row.quality })),
      };
    };
    const linksSnapshot = snapshot(linkRecords, linkRecordsAll, inventoryData ? inventoryData.assets.filter((asset) => asset.categories.includes("links")) : null);
    const devicesSnapshot = snapshot(deviceRecords, deviceRecordsAll, inventoryData ? inventoryData.assets.filter((asset) => asset.categories.includes("devices")) : null);
    const allFilteredRecords = filterRecords(records, filters);
    const allDatedRecords = allFilteredRecords.filter((record) => record.startedAt && !Number.isNaN(record.startedAt.getTime()));
    const allItsm = getItsmOperationalSummary(allFilteredRecords);
    const correlationKeys = new Set(allFilteredRecords.flatMap(row => [...extractIssueKeys(row.ticket), ...extractIssueKeys(row.comment)]));
    const correlation = correlateItsm(allFilteredRecords, itsmData?.records ?? [], subtaskData?.records ?? [], correlationKeys);
    const allTechnicians = rankItsmTicketsForAlarmPeriod(itsmData?.records ?? [], allDatedRecords);
    const inventoryOperators = inventorySummary.operators.map((row) => ({ name: row.name, links: row.links, assets: row.assets, availabilityPercent: row.availabilityPercent }));
    const inventoryLocalities = inventorySummary.localities.map((row) => ({ name: row.name, links: row.links, assets: row.assets, availabilityPercent: row.availabilityPercent }));
    const activeSnapshot = activeTab === "links" ? linksSnapshot : devicesSnapshot;
    const activeAvailability = activeTab === "links" ? getAvailability(linkRecords, filterRecords(linkRecords, filters), filters, inventoryData ? inventoryData.assets.filter((asset) => asset.categories.includes("links")) : null, Boolean(inventoryData && inventoryData.localityColumnIndex !== null), Boolean(inventoryData && inventoryData.operatorColumnIndex !== null)) : getAvailability(deviceRecords, filterRecords(deviceRecords, filters), filters, inventoryData ? inventoryData.assets.filter((asset) => asset.categories.includes("devices")) : null, Boolean(inventoryData && inventoryData.localityColumnIndex !== null), Boolean(inventoryData && inventoryData.operatorColumnIndex !== null));
    return {
      period: `${monthTitle}${filters.from ? ` · de ${filters.from}` : ""}${filters.to ? ` · até ${filters.to}` : ""}`,
      category: "Consolidado: Links + Dispositivos + ITSM + Inventário",
      activeCategory: activeTab === "links" ? "Links" : "Dispositivos",
      locality: filters.locality || "Todas as localidades",
      appliedFilters: {
        operator: filters.operator || "Todas as operadoras",
        locality: filters.locality || "Todas as localidades",
        alarmResponsible: filters.responsible || "Todos os responsáveis",
        deviceType: filters.deviceType || "Todos os tipos de dispositivo",
        alarmType: filters.sourceType || "Todos os tipos",
        trap: filters.trap || "Todas as origens/traps",
        itsmStatus: filters.itsmStatus || "Todos os status ITSM",
        itsmResponsible: filters.itsmResponsible || "Todos os responsáveis ITSM",
        textSearchActive: Boolean(filters.search.trim()),
      },
      alarmRows: activeSnapshot.alarmRows,
      downtimeHours: activeSnapshot.downtimeHours,
      availabilityPercent: activeSnapshot.availabilityPercent,
      monitoredAssets: activeSnapshot.monitoredAssets,
      totalAssetHours: activeSnapshot.totalAssetHours,
      topAssets: activeSnapshot.topAssets,
      topOperators: activeSnapshot.topOperators,
      ticketsByTechnician: allTechnicians.rows.slice(0, 5).map((row) => ({ name: row.name, tickets: row.alarms })),
      oscillationOffenders: allItsm.oscillationOffenders.map((row) => ({ name: row.name, operator: row.operator, locality: row.locality, alarms: row.alarms, totalMinutes: Number(row.totalMinutes.toFixed(2)), averageMinutes: Number(row.averageMinutes.toFixed(2)), sharePercent: Number(row.sharePercent.toFixed(2)) })),
      mtfbByOperatorLocality: activeSnapshot.mtfbByOperatorLocality,
      categories: { links: linksSnapshot, devices: devicesSnapshot },
      itsm: {
        alarmsInScope: allFilteredRecords.length,
        ticketsOpened: allItsm.ticketsOpened,
        ticketsResolved: allItsm.ticketsResolved,
        averageResolutionMinutes: allItsm.averageResolutionMinutes,
        reasonBreakdown: allItsm.reasonBreakdown.map((row) => ({ reason: row.reason, tickets: row.tickets, sharePercent: Number(row.sharePercent.toFixed(2)) })),
        oscillationOffenders: allItsm.oscillationOffenders.map((row) => ({ name: row.name, operator: row.operator, locality: row.locality, alarms: row.alarms, totalMinutes: Number(row.totalMinutes.toFixed(2)), averageMinutes: Number(row.averageMinutes.toFixed(2)), sharePercent: Number(row.sharePercent.toFixed(2)) })),
        ticketsByTechnician: allTechnicians.rows.slice(0, 5).map((row) => ({ name: row.name, tickets: row.alarms })),
      },
      itsmCorrelation: { alerts: allFilteredRecords.length, linkedAlerts: correlation.linkedAlerts, confirmedAlerts: correlation.confirmedAlerts, incidents: correlation.incidents.length, subtasks: correlation.linkedSubtasks, ambiguousSubtasks: correlation.ambiguousSubtasks, conflictingIncidents: correlation.conflictingIncidents, reasons: correlation.reasons },
      inventory: { totalLinks: inventorySummary.totalLinks, totalAssets: inventorySummary.totalAssets, averageOperatorAvailability: inventorySummary.averageOperatorAvailability, averageLocalityAvailability: inventorySummary.averageLocalityAvailability, operators: inventoryOperators, localities: inventoryLocalities },
      dataQuality: {
        alarmHostsMissingFromInventory: linksSnapshot.monitoredAssets + devicesSnapshot.monitoredAssets > 0 ? activeAvailability.unmatchedAssets.length : 0,
        alarmRowsWithoutDateOrHost: activeAvailability.excludedRecords,
        inventoryLocalityIssues: inventorySummary.localities.reduce((sum, row) => sum + (row.availabilityStatus.includes("incomplete") ? 1 : 0), 0),
        alarmsWithoutUniqueItsmMatch: allTechnicians.unmatchedAlarmRows,
        durationCoveragePercent: allFilteredRecords.length ? Math.round((allFilteredRecords.filter((record) => record.durationMinutes !== null && record.durationMinutes >= 0).length / allFilteredRecords.length) * 100) : 0,
        availabilityStatus: `Links: ${linksSnapshot.availabilityPercent === null ? "indisponível" : "calculada"}; Dispositivos: ${devicesSnapshot.availabilityPercent === null ? "indisponível" : "calculada"}`,
        mtfbIntervals: linksSnapshot.mtfbByOperatorLocality.reduce((sum, row) => sum + row.intervals, 0) + devicesSnapshot.mtfbByOperatorLocality.reduce((sum, row) => sum + row.intervals, 0),
      },
    };
  }, [monthTitle, filters, activeTab, linkRecords, deviceRecords, linkRecordsAll, deviceRecordsAll, records, inventoryData, inventorySummary, itsmData, subtaskData]);

  const scopeFilters = (
              <section className="filter-panel panel">
                <div className="filter-panel__heading">
                  <div className="panel-heading__icon"><CalendarDays size={17} /></div>
                  <div className="panel-heading__copy">
                    <h2>Recorte operacional</h2>
                    <p>{filtersExpanded ? "Os indicadores são recalculados a cada alteração" : monthTitle}</p>
                  </div>
                  <div className="filter-panel__actions" style={{ flexWrap: "wrap" }}>
                    <span className="filter-result"><span className="live-dot" />{formatNumber(page === "itsm" ? filterRecords(records, filters).length : filtered.length)} no recorte</span>
                    {filtersExpanded && <button className="button button--quiet button--small" type="button" onClick={resetFilters}><FilterX size={14} />Limpar filtros</button>}
                    <button
                      className="button button--quiet button--small"
                      type="button"
                      aria-expanded={filtersExpanded}
                      aria-controls="operational-filter-controls"
                      onClick={() => setFiltersExpanded((expanded) => !expanded)}
                    >
                      {filtersExpanded ? "Ocultar filtros" : "Mostrar filtros"}
                    </button>
                  </div>
                </div>
                <div id="operational-filter-controls" hidden={!filtersExpanded}>
                <div className="filters-grid">
                  <label className="filter-field filter-field--period"><span>Período / mês</span><span className="select-wrap"><select value={filters.month} onChange={(event) => updateFilter("month", event.target.value)}><option value="all">Todos os meses</option>{monthOptions.map((month) => <option key={month} value={month}>{monthLabel(month)}</option>)}</select><ChevronDown size={14} /></span></label>
                  <label className="filter-field"><span>De</span><input type="date" value={filters.from} onChange={(event) => updateFilter("from", event.target.value)} aria-label="Data inicial" /></label>
                  <label className="filter-field"><span>Até</span><input type="date" value={filters.to} onChange={(event) => updateFilter("to", event.target.value)} aria-label="Data final" /></label>
                  <SelectField label="Operadora" value={filters.operator} values={availableFilters.operators} onChange={(value) => updateFilter("operator", value)} />
                  <SelectField label="Localidade" value={filters.locality} values={availableFilters.localities} onChange={(value) => updateFilter("locality", value)} />
                  <SelectField label="Responsável do alarme" value={filters.responsible} values={availableFilters.responsibles} onChange={(value) => updateFilter("responsible", value)} />
                  <SelectField label="Tipo de dispositivo" value={filters.deviceType} values={availableFilters.deviceTypes} onChange={(value) => updateFilter("deviceType", value)} />
                  <SelectField label="TIPO" value={filters.sourceType} values={availableFilters.sourceTypes} onChange={(value) => updateFilter("sourceType", value)} />
                  <SelectField label="Origem / trap" value={filters.trap} values={availableFilters.traps} onChange={(value) => updateFilter("trap", value)} />
                  <SelectField label="Status ITSM" value={filters.itsmStatus} values={availableFilters.itsmStatuses} onChange={(value) => updateFilter("itsmStatus", value)} />
                  <SelectField label="Responsável ITSM" value={filters.itsmResponsible} values={availableFilters.itsmResponsibles} onChange={(value) => updateFilter("itsmResponsible", value)} />
                </div>
                {dateRangeError ? <p className="filter-error"><AlertTriangle size={13} />A data inicial precisa ser anterior à data final.</p> : null}
                <div className="filter-bottom-row">
                  <div className="quick-period"><button className="quick-period__button" onClick={() => setFilters((current) => ({ ...current, month: quickMonth, from: "", to: "" }))}><CalendarDays size={13} />Mês anterior</button><span>{page === "itsm" ? "Mês anterior ao último registro das fontes ITSM ou de alertas" : "Mês anterior ao último registro que atende aos filtros operacionais"}</span></div>
                  <label className="search-field"><Search size={15} /><input aria-label="Buscar alarmes, links, tickets, operadoras ou campos ITSM" value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Buscar alarme, link, ticket…" /><kbd>⌕</kbd></label>
                </div>
                </div>
              </section>
  );

  return (
    <SolorShell page={page} onNavigate={navigate} logo={companyLogo} logoScale={logoScale} readOnly={readOnly} canUseAi={canUseAi} shared={documents !== localDocuments}>
    <div className={`app-shell solor-page solor-page--${page}`}>
      <header className="topbar">
        <a className="brand" href="./index.html" aria-label="Painel NOC Operadoras">
          <span className="brand-mark"><Network size={19} strokeWidth={1.9} /><i /></span>
          <span className="brand-copy"><strong>NOC <em>/</em> OPERADORAS</strong><small>LINK RELIABILITY CONSOLE</small></span>
        </a>
        <div className="topbar-status"><span className="privacy-status"><ShieldCheck size={14} />Processamento local</span><span className="live-dot" /><span className="live-label">AMBIENTE SEGURO</span></div>
      </header>

      <div className="main-content">
        <section className="page-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" />OPERAÇÕES SOLOR <span className="eyebrow-divider">/</span> OPERA DASH</div>
            <h1>{pageLabels[page]}</h1>
            <p className="page-subtitle">Alarmes, atendimento e indisponibilidade em uma única leitura.</p>
          </div>
          <div className="page-heading__actions">
            {data ? <div className="heading-meta"><span className="meta-label">PERÍODO EM FOCO</span><strong>{monthTitle}</strong><span className="meta-file"><FileSpreadsheet size={13} />{data.fileName}</span></div> : null}
            {!readOnly && <button className="button button--quiet button--small sidebar-toggle" type="button" onClick={() => navigate(page === "sources" ? "overview" : "sources")} aria-expanded={sidebarOpen} aria-controls="data-sidebar"><span>{sidebarOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}</span>{page === "sources" ? "Voltar à visão geral" : "Gerenciar fontes"}</button>}
          </div>
        </section>

        <div className={`dashboard-layout${sidebarOpen ? "" : " dashboard-layout--collapsed"}`}>
          {sidebarOpen ? (
            <aside className="data-sidebar" id="data-sidebar" aria-label="Planilhas, dados identificados e configuração de IA">
              <div className="data-sidebar__heading"><span className="section-kicker">FONTES E CONFIGURAÇÃO</span><h2>Suas fontes de dados</h2><p>Importe, confira os campos reconhecidos e escolha como analisar.</p></div>
              <input ref={inputRef} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="visually-hidden" aria-label="Importar alertas TelcoManager CSV ou XLSX" onChange={onFileInput} />
              <input ref={itsmInputRef} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="visually-hidden" aria-label="Importar incidentes Jira CSV ou XLSX" onChange={onItsmFileInput} />
              <input ref={inventoryInputRef} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="visually-hidden" aria-label="Importar inventário CSV ou XLSX" onChange={onInventoryFileInput} />
              {extensionEnvironment ? <SharePointPublicFilePanel onFile={(nextFile) => void processFile(nextFile)} /> : null}
              <AlarmUploadPanel result={data} busy={busy} error={error} dragging={dragging} onSelect={() => inputRef.current?.click()} onRemove={async () => { try { await removeImportedDocument("alarms"); setData(null); setAlarmPreview(null); setFile(null); setError(""); setFilters(emptyFilters()); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível remover os alertas."); } }} onSheetChange={(sheetName) => { if (file) void processFile(file, sheetName); }} onFileDrop={(nextFile) => void processFile(nextFile)} onDragChange={setDragging} />
              {(data ?? alarmPreview) ? <ColumnMappingPanel title="Mapear colunas de alertas" fileName={(data ?? alarmPreview)!.fileName} sheetName={(data ?? alarmPreview)!.sheetName} totalRows={(data ?? alarmPreview)!.totalRows} columns={(data ?? alarmPreview)!.detectedColumns} mapping={(data ?? alarmPreview)!.columnMapping} fields={alarmMappingFields} busy={busy} onApply={mapping => { if (file) void processFile(file, (data ?? alarmPreview)!.sheetName, mapping); }} /> : null}
              {data?.warnings.length ? <details className="itsm-warnings sidebar-source-warnings"><summary><AlertTriangle size={13} />{formatNumber(data.warnings.length)} aviso(s) dos alarmes</summary><ul>{data.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details> : null}
              <ItsmUploadPanel fileName={itsmData?.fileName ?? null} result={itsmData} summary={itsmSummary} busy={itsmBusy} error={itsmError} onSelect={() => itsmInputRef.current?.click()} onRemove={removeItsm} onSheetChange={(sheetName) => { if (itsmFile) void processItsmFile(itsmFile, sheetName); }} />
              {itsmData ? <ColumnMappingPanel title="Mapear colunas de incidentes" fileName={itsmData.fileName} sheetName={itsmData.sheetName} totalRows={itsmData.totalRows} columns={itsmData.detectedColumns} mapping={itsmData.columnMapping} fields={itsmMappingFields} busy={itsmBusy} onApply={mapping => { if (itsmFile) void processItsmFile(itsmFile, itsmData.sheetName, mapping); }} /> : null}
              <input ref={subtaskInputRef} type="file" accept=".csv,.xlsx" className="visually-hidden" aria-label="Importar subtarefas Jira XLSX" onChange={event => { const file = event.target.files?.[0]; if (file) void processSubtasks(file); event.target.value = ''; }} />
              <SubtaskUploadPanel result={subtaskData} busy={subtaskBusy} error={subtaskError} onSelect={() => subtaskInputRef.current?.click()} onRemove={async () => { try { await removeImportedDocument('subtasks'); setSubtaskData(null); setSubtaskFile(null); setSubtaskError(''); } catch (cause) { setSubtaskError(cause instanceof Error ? cause.message : 'Não foi possível remover as subtarefas.'); } }} />
              {subtaskData ? <ColumnMappingPanel title="Mapear colunas de subtarefas" fileName={subtaskData.fileName} sheetName={subtaskData.sheetName} totalRows={subtaskData.totalRows} columns={subtaskData.detectedColumns} mapping={subtaskData.columnMapping} fields={subtaskMappingFields} busy={subtaskBusy} onApply={mapping => { if (subtaskFile) void processSubtasks(subtaskFile, subtaskData.sheetName, mapping); }} /> : null}
              <InventoryUploadPanel
                fileName={inventoryData?.fileName ?? null}
                result={inventoryData}
                busy={inventoryBusy}
                error={inventoryError}
                onSelect={() => inventoryInputRef.current?.click()}
                onRemove={removeInventory}
                onSheetChange={(sheetName) => { if (inventoryFile) void processInventoryFile(inventoryFile, sheetName); }}
                onHostColumnChange={(columnIndex) => { if (inventoryFile && inventoryData) void processInventoryFile(inventoryFile, inventoryData.sheetName, columnIndex, inventoryData.categoryColumnIndex, inventoryData.localityColumnIndex, inventoryData.operatorColumnIndex); }}
                onCategoryColumnChange={(columnIndex) => { if (inventoryFile && inventoryData) void processInventoryFile(inventoryFile, inventoryData.sheetName, inventoryData.hostColumnIndex ?? undefined, columnIndex, inventoryData.localityColumnIndex, inventoryData.operatorColumnIndex); }}
                onOperatorColumnChange={(columnIndex) => { if (inventoryFile && inventoryData) void processInventoryFile(inventoryFile, inventoryData.sheetName, inventoryData.hostColumnIndex ?? undefined, inventoryData.categoryColumnIndex, inventoryData.localityColumnIndex, columnIndex); }}
                onLocalityColumnChange={(columnIndex) => { if (inventoryFile && inventoryData) void processInventoryFile(inventoryFile, inventoryData.sheetName, inventoryData.hostColumnIndex ?? undefined, inventoryData.categoryColumnIndex, columnIndex, inventoryData.operatorColumnIndex); }}
              />
              {inventoryData ? <DetectedColumnsPanel title="Colunas do inventário" fileName={inventoryData.fileName} sheetName={inventoryData.sheetName} totalRows={inventoryData.totalRows} columns={inventoryDetectedColumns} /> : null}
              {canUseAi && <CompanyLogoSettings logo={companyLogo} onChange={setCompanyLogo} scale={logoScale} onScaleChange={setLogoScale} />}
              <SourceTemplates />
              {canUseAi && <JiraSettings value={jiraBaseUrl} onChange={setJiraBaseUrl} />}
              <DataQualityPanel filteredCount={filtered.length} durationIncluded={mttr.included} availabilityStatus={availability.status} availabilityExcluded={availability.excludedRecords} unmatchedAssets={availability.unmatchedAssets.length} inventoryLoaded={Boolean(inventoryData)} mtfbGroups={mtfbSummary.groupsWithBase} mtfbIntervals={mtfbSummary.intervals} />
            </aside>
          ) : null}
          <div className="dashboard-primary">
          {(page === "itsm" || page === "inventory") ? scopeFilters : null}
        {page === 'overview' ? <Overview data={data} incidents={itsmData} subtasks={subtaskData} inventory={inventoryData} onNavigate={navigate} readOnly={readOnly} shared={documents !== localDocuments} /> : page === 'sources' ? null : page === 'itsm' ? <>
          <ItsmCorrelationPanel alerts={filterRecords(records, filters)} allAlerts={records} incidents={itsmData} subtasks={subtaskData} hasAlerts={Boolean(data)} filters={filters} />
          {data && <details className="solor-legacy-details"><summary>Indicadores operacionais complementares · {activeTab === 'links' ? 'Links' : 'Dispositivos'}</summary><ItsmIndicatorsPanel summary={itsmIndicators} hasItsm={Boolean(itsmData)} categoryLabel={activeTab === 'links' ? 'Links' : 'Dispositivos'} periodLabel={monthTitle} /></details>}
        </> : page === 'inventory' ? <InventoryPanel summary={inventorySummary} periodLabel={monthTitle} /> : page === 'ai' ? <LocalAIAssistant context={localAiContext} hasDashboardData={Boolean(data)} /> : data ? (
          <>
            <div className="analysis-tabs">
              <div className="analysis-tabs__categories"><CategoryTabs activeTab={activeTab} onChange={(nextTab) => { setActiveTab(nextTab); setActiveView("operational"); setFilters((current) => ({ ...current, sourceType: "" })); }} linkCount={linkRecords.length} deviceCount={deviceRecords.length} /></div>
              <button className={`category-tab analysis-tab--itsm ${activeView === "itsm" ? "category-tab--active" : ""}`} type="button" onClick={() => setActiveView("itsm")} aria-selected={activeView === "itsm"}>
                <span className="category-tab__icon"><ClipboardList size={17} /></span><span className="category-tab__copy"><strong>Indicadores ITSM</strong><small>Incidentes, tickets e solução</small></span><span className="category-tab__count">{itsmData ? formatNumber(itsmIndicators.ticketsOpened) : "—"}</span>
              </button>
              <button className={`category-tab analysis-tab--inventory ${activeView === "inventory" ? "category-tab--active" : ""}`} type="button" onClick={() => setActiveView("inventory")} aria-selected={activeView === "inventory"}>
                <span className="category-tab__icon"><Boxes size={17} /></span><span className="category-tab__copy"><strong>Inventário</strong><small>Ativos, operadoras e cidades</small></span><span className="category-tab__count">{inventoryData ? formatNumber(inventorySummary.totalAssets) : "—"}</span>
              </button>
              <button className={`category-tab analysis-tab--ai ${activeView === "ai" ? "category-tab--active" : ""}`} type="button" onClick={() => setActiveView("ai")} aria-selected={activeView === "ai"}>
                <span className="category-tab__icon"><BrainCircuit size={17} /></span><span className="category-tab__copy"><strong>Análise IA</strong><small>Insights orientados por tema</small></span><span className="category-tab__count">{localAiContext.alarmRows ? formatNumber(localAiContext.alarmRows) : "—"}</span>
              </button>
            </div>
            {activeView === "itsm" ? <ItsmIndicatorsPanel summary={itsmIndicators} hasItsm={Boolean(itsmData)} categoryLabel={activeTab === "links" ? "Links" : "Dispositivos"} periodLabel={monthTitle} /> : activeView === "inventory" ? <InventoryPanel summary={inventorySummary} periodLabel={monthTitle} /> : activeView === "ai" ? <div className="analysis-ai-tab"><LocalAIAssistant context={localAiContext} hasDashboardData={Boolean(data)} /></div> : <div id={activeTab === "links" ? "panel-links" : "panel-devices"} role="tabpanel" aria-labelledby={activeTab === "links" ? "tab-links" : "tab-devices"} tabIndex={0} className="category-panel">
              {scopeFilters}

              {filters.locality ? <LocalityInventoryCards
                locality={filters.locality}
                category={activeTab}
                assets={localityInventoryAssets}
                hoursPerAsset={availability.hoursPerAsset}
                totalHours={availability.totalHours}
                localityIssueAssets={availability.localityIssueAssets}
                hasLocalityColumn={Boolean(inventoryData && inventoryData.localityColumnIndex !== null)}
                inventoryLoaded={Boolean(inventoryData)}
                jiraBaseUrl={jiraBaseUrl}
              /> : null}

              <div className="section-title-row">
                <div><span className="section-kicker">SINAIS DO PERÍODO</span><h2>Saúde operacional</h2></div>
                <span className="period-context"><span className="context-pip" />{monthTitle}<span className="context-separator">·</span>{formatNumber(filtered.length)} alarmes</span>
              </div>

              <section className="metrics-grid" aria-label="Indicadores principais">
                <MetricCard label="Alarmes no período" value={formatNumber(filtered.length)} detail={filters.month === "all" ? "Todos os alarmes do recorte" : `Registros em ${monthTitle}`} icon={<Signal size={17} />} tone="cyan" footnote={filtered.length ? `${formatNumber(new Set(filtered.map((row) => row.device)).size)} ${activeTab === "links" ? "links" : "dispositivos"} afetados` : "Aguardando dados"} />
                <MetricCard label="MTTR médio" value={formatMinutes(mttr.minutes, true)} detail="Tempo médio por registro com duração válida" icon={<Clock3 size={17} />} tone="blue" footnote={`${formatNumber(mttr.included)} de ${formatNumber(filtered.length)} alarmes considerados`} />
                <MetricCard label="Percentual de atuação" value={formatPercent(acknowledgement.percent)} detail="Alarmes reconhecidos pelo noc-solor" icon={<Users size={17} />} tone="green" footnote={`${formatNumber(acknowledgement.acted)} de ${formatNumber(acknowledgement.total)} alarmes`} />
                <MetricCard label="Indisponibilidade somada" value={formatMinutes(downtime, true)} detail={activeTab === "devices" ? "Horas acumuladas no recorte" : "Horas-link acumuladas no recorte"} icon={<Activity size={17} />} tone="amber" footnote="Soma das durações por registro" />
                <MetricCard
                  label="Disponibilidade média da operação"
                  value={formatPercent(availability.percent)}
                  detail={availabilityDetail}
                  icon={<ShieldCheck size={17} />}
                  tone="green"
                  footnote={availabilityFootnote}
                />
                <MetricCard label="MTFB médio" value={formatMinutes(mtfbSummary.meanMinutes, true)} detail={`Mediana ${formatMinutes(mtfbSummary.medianMinutes, true)} · média ponderada`} icon={<Clock3 size={17} />} tone="amber" footnote={`${formatNumber(mtfbSummary.intervals)} intervalos em ${formatNumber(mtfbSummary.groupsWithBase)} grupos operadora × localidade`} />
              </section>
              {availability.unmatchedAssets.length || availability.excludedRows.length || availability.localityIssueAssets ? (
                <details className="availability-diagnostics">
                  <summary><AlertTriangle size={14} /><span>Revisar disponibilidade · {inventoryAssets === null ? "inventário ainda não carregado" : `${formatNumber(availability.unmatchedAssets.length)} host(s) fora do inventário`} · {formatNumber(availability.excludedRecords)} linha(s) sem data/host</span><ChevronDown size={14} /></summary>
                  <div className="availability-diagnostics__content">
                    {availability.unmatchedAssets.length ? <div><strong>Identificadores de alarmes ausentes no inventário</strong><ul>{availability.unmatchedAssets.map((asset) => <li key={asset.name}><code>{asset.name}</code><span>linhas {formatSourceRows(asset.sourceRows)}</span></li>)}</ul></div> : null}
                    {availability.localityIssueAssets ? <div><strong>Hosts sem localidade única no inventário</strong><p>{formatNumber(availability.localityIssueAssets)} ativo(s) precisam de uma localidade preenchida e não conflitante para o cálculo municipal.</p></div> : null}
                    {availabilityExcludedGroups.length ? <div><strong>Linhas excluídas da disponibilidade</strong><ul>{availabilityExcludedGroups.map(([reason, rows]) => <li key={reason}><code>{reason}</code><span>linhas {formatSourceRows(rows)}</span></li>)}</ul></div> : null}
                  </div>
                </details>
              ) : null}

              <div className="section-title-row section-title-row--rankings">
                <div><span className="section-kicker">CONCENTRAÇÃO DE IMPACTO</span><h2>Onde a indisponibilidade se acumula</h2></div>
                <button className="method-link" onClick={() => setShowMethod((value) => !value)}><CircleHelp size={14} />Como calculamos</button>
              </div>
              {showMethod ? (
                <div className="method-note">
                  <strong>Critérios de leitura</strong>
                  <p>MTTR é a média de <code>DuracaoMinutos</code> (com fallback para Horário Final − Horário Inicial) por registro com duração válida. Não havendo ID único de incidente, cada linha conta como um alarme/episódio. Todos os cálculos baseados em alarmes e tickets usam o mesmo recorte selecionado: categoria, período/datas, operadora, localidade, responsável do alarme, tipo de dispositivo, TIPO, origem/trap, status e responsável ITSM e busca. Isso inclui indicadores, rankings, ranking de técnicos, gráficos, tabela e exportação. O ranking de técnicos conta somente tickets únicos conciliados com alarmes datados que atendem a esses filtros; usa a ITSM completa apenas como catálogo de tickets para a conciliação. Duplicatas são consolidadas pela atualização mais recente e tickets sem responsável ficam em “Sem responsável atribuído”. Atuação conta responsáveis do alarme contendo “noc-solor”, sem diferenciar maiúsculas/minúsculas. A disponibilidade usa 24 h por dia × dias do recorte × ativos únicos da categoria ativa no inventário. Alarmes que formam o numerador seguem todos os filtros e precisam ter data, host e correspondência no inventário. O denominador representa os ativos monitorados, não a quantidade de alarmes: ele muda com a categoria e, quando selecionada, a localidade do inventário; filtros de evento como operadora, status ITSM ou busca restringem os alarmes/downtime, mas não excluem ativos monitorados sem que esse atributo também esteja mapeado no inventário. Em “Todos os meses”, os limites são definidos pelo primeiro e último mês datados que permanecem após os filtros; se não houver alarme correspondente, não é exibido percentual. O inventário usa a coluna identificadora escolhida; sem coluna TIPO, nomes iniciados por LINK são classificados como links. Ativos da cidade precisam ter localidade completa e sem conflito; alarmes sem correspondência e linhas sem data/host são sinalizados. O inventário é assumido constante ao longo do histórico, pois não informa vigência. A indisponibilidade somada preserva a soma bruta por registro. Flapping e oscilações são analisados exclusivamente na aba Indicadores ITSM, considerando duração menor que 40 minutos e destaque para ativos com pelo menos 4 ocorrências em uma janela móvel de 2 horas. Alarmes simultâneos/repetidos podem superestimar a indisponibilidade bruta; se a métrica bruta superar as horas-ativo, o percentual fica indisponível. Os cards da cidade mostram hosts/links do inventário, inclusive sem alarmes. MTTR e rankings por link, localidade e operadora somam durações por registro, não tempo único da rede. As comparações usam os mesmos filtros no período selecionado e no mês-base; “Sem base” indica ausência de cobertura datada ou de duração válida quando há alarmes filtrados. Com cobertura no mês-base e nenhum alarme correspondente aos filtros ativos, a contagem e a indisponibilidade são comparadas como zero. Contagens e indisponibilidade usam variação relativa percentual; atuação usa pontos percentuais (p.p.). A série anual e suas barras também respeitam os filtros, inclusive período e ano.</p>
                  <button onClick={() => setShowMethod(false)} aria-label="Fechar metodologia"><X size={14} /></button>
                </div>
              ) : null}
              <div className="month-comparison-note" role="note">{monthComparison ? `Comparação do recorte filtrado: ${monthComparison.currentLabel} vs. ${monthComparison.previousLabel}. Os mesmos filtros operacionais e as mesmas datas deslocadas para o mês anterior são preservados nos recortes parciais.` : "Selecione um único mês ou um intervalo contido no mesmo mês para comparar rankings e faixas com o mês anterior. As comparações mantêm os filtros operacionais; o gráfico anual também aplica período e filtros a cada barra."}</div>

              <Suspense fallback={<div className="chart-empty"><span className="empty-mark">···</span><p>Preparando visualizações do período.</p></div>}>
                <section className="rankings-grid" aria-label="Rankings de indisponibilidade">
                  <RankChart title={activeTab === "links" ? "Links ofensores" : "Dispositivos ofensores"} description="Maior tempo de indisponibilidade somado" rows={linkRanking} metric="downtime" currentComparisonRows={currentLinkComparison} comparisonRows={previousLinkRanking} comparisonLabel={comparisonLabel} comparisonHasBaseline={comparisonHasBaseline} comparisonRecordCount={previousFiltered.length} icon={<Cable size={16} />} jiraBaseUrl={jiraBaseUrl} />
                  <RankChart title="Localidades críticas" description="Maior tempo de indisponibilidade somado" rows={localityRanking} metric="downtime" currentComparisonRows={currentLocalityComparison} comparisonRows={previousLocalityRanking} comparisonLabel={comparisonLabel} comparisonHasBaseline={comparisonHasBaseline} comparisonRecordCount={previousFiltered.length} icon={<MapPin size={16} />} />
                  {activeTab === "links" ? <>
                    <RankChart title="Operadoras · incidentes" description="Mais alarmes no recorte selecionado" rows={operatorIncidents} metric="alarms" currentComparisonRows={currentOperatorIncidents} comparisonRows={previousOperatorIncidents} comparisonLabel={comparisonLabel} comparisonHasBaseline={comparisonHasBaseline} comparisonRecordCount={previousFiltered.length} icon={<Users size={16} />} />
                    <RankChart title="Operadoras · indisponibilidade" description="Maior tempo total acumulado" rows={operatorDowntime} metric="downtime" currentComparisonRows={currentOperatorDowntime} comparisonRows={previousOperatorDowntime} comparisonLabel={comparisonLabel} comparisonHasBaseline={comparisonHasBaseline} comparisonRecordCount={previousFiltered.length} icon={<Database size={16} />} />
                  </> : null}
                </section>
              </Suspense>

              <MtfbPanel rows={mtfbRows} categoryLabel={activeTab === "links" ? "Links" : "Dispositivos"} />

              <div className="insights-grid" aria-label="Atuação por período e volume anual">
                <DaypartActuation rows={dayparts.rows} unclassified={dayparts.unclassified} previousRows={previousDayparts} comparisonLabel={comparisonLabel} />
                <Suspense fallback={<div className="chart-empty annual-panel panel"><span className="empty-mark">···</span><p>Preparando o volume anual.</p></div>}>
                  <AnnualVolumeChart year={selectedYear} years={years} yearPinned={yearPinned} periodConstrained={filters.month !== "all" || Boolean(filters.from || filters.to)} onYearChange={setChartYear} volume={annualVolume} history={monthlyHistory} selectedPeriodComparison={monthComparison ? { currentLabel: monthComparison.currentLabel, previousLabel: monthComparison.previousLabel, currentAlarms: currentDatedRecords.length, previousAlarms: previousDatedRecords.length, hasPreviousData: comparisonHasBaseline } : null} />
                </Suspense>
              </div>

              {itsmData ? (
                <Suspense fallback={<div className="chart-empty"><span className="empty-mark">···</span><p>Calculando tickets por técnico.</p></div>}>
                  <div className="rankings-grid itsm-technician-ranking" aria-label="Ranking de tickets ITSM por técnico">
                    <RankChart
                      title="Tickets por técnico"
                      description="TOP 5 · tickets ITSM únicos ligados a alarmes do período selecionado"
                      rows={technicianTickets.rows}
                      metric="alarms"
                      metricLabel="Tickets"
                      currentComparisonRows={currentTechnicianComparison.rows}
                      comparisonRows={previousTechnicianTickets.rows}
                      comparisonLabel={comparisonLabel}
                      comparisonHasBaseline={technicianComparisonHasBaseline}
                      comparisonRecordCount={previousDatedRecords.length}
                      icon={<Users size={16} />}
                      emptyLabel="Nenhum ticket ITSM único foi conciliado com alarmes datados neste período."
                      footnote={technicianTicketFootnote}
                    />
                  </div>
                </Suspense>
              ) : null}

              <AlarmTable records={filtered} category={activeTab} onExport={() => exportCsv(filtered, activeTab)} jiraBaseUrl={jiraBaseUrl} />

              <footer className="dashboard-footer"><span><ShieldCheck size={14} />{documents === localDocuments ? "Dados mantidos neste navegador" : "Dados do cliente"}</span><span>MTTR calculado em {formatNumber(mttr.included)} registros válidos</span><span>{data.sheetName} · {data.fileName}</span></footer>
            </div>}
          </>
        ) : (
          <section className="empty-preview">
            <div className="empty-preview__header"><div><span className="section-kicker">PRONTO PARA ANALISAR</span><h2>O que aparece no painel</h2></div><span className="empty-state-pill"><span className="live-dot" />SEM ARQUIVO CARREGADO</span></div>
            <div className="preview-metrics">
              <div className="preview-metric"><span><Signal size={15} />VOLUME</span><strong>Alarmes por período</strong><p>Todos os registros que correspondem ao filtro</p></div>
              <div className="preview-metric"><span><Clock3 size={15} />TEMPO DE RESTABELECIMENTO</span><strong>MTTR médio</strong><p>Média de duração disponível em cada incidente</p></div>
              <div className="preview-metric"><span><Users size={15} />ATUAÇÃO NOC</span><strong>Reconhecimento noc-solor</strong><p>Percentual de alarmes atuados no recorte</p></div>
              <div className="preview-metric"><span><MapPin size={15} />INDISPONIBILIDADE</span><strong>TOP 5 ofensores</strong><p>Links, localidades e operadoras com maior impacto</p></div>
            </div>
            <div className="empty-preview__foot"><span><CalendarDays size={14} />A visão inicial usa o mês anterior ao último registro disponível no arquivo.</span><span><ArrowDownToLine size={14} />Exporte os alarmes filtrados em CSV após importar.</span></div>
          </section>
        )}

          </div>
        </div>
        <footer className="page-footer"><span>OPERADORAS <i>·</i> NOC RELIABILITY CONSOLE</span><span>Indicadores sujeitos à qualidade e granularidade das planilhas de origem.</span></footer>
      </div>
    </div>
    </SolorShell>
  );
}
