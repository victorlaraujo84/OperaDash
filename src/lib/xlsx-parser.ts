import * as XLSX from "xlsx";
import { readInputWorkbook } from './csv-workbook';
import type { AlarmClassification, AlarmRecord, DetectedColumn, ImportResult } from "../types/operadora";

const UNKNOWN = "Não informada";

type Cell = unknown;
type Matrix = Cell[][];

function normalize(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function text(value: Cell): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toLocaleString("pt-BR");
  return String(value).trim();
}

function cellAt(row: Cell[], index: number | undefined): Cell {
  return index === undefined ? "" : row[index];
}

function findColumn(headers: string[], aliases: string[]): number | undefined {
  const normalizedHeaders = headers.map(normalize);
  for (const alias of aliases) {
    const index = normalizedHeaders.indexOf(normalize(alias));
    if (index >= 0) return index;
  }
  return undefined;
}

function parseDate(value: Cell): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const parts = XLSX.SSF.parse_date_code(value);
    if (!parts) return null;
    const date = new Date(parts.y, parts.m - 1, parts.d, parts.H, parts.M, Math.floor(parts.S));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const valueText = text(value);
  if (!valueText) return null;

  const brazilian = valueText.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (brazilian) {
    const [, day, month, year, hour = "0", minute = "0", second = "0"] = brazilian;
    const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
    if (date.getFullYear() === Number(year) && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day)) return date;
    return null;
  }

  const parsed = new Date(valueText);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseDuration(value: Cell, explicitMinutes: boolean): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value < 0) return null;
    return explicitMinutes ? value : value < 1 ? value * 1440 : value;
  }
  const valueText = text(value);
  if (!valueText) return null;

  const timeSpan = valueText.match(/^(\d{1,6}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?$/);
  if (timeSpan) {
    const hours = Number(timeSpan[1]);
    const minutes = Number(timeSpan[2]);
    const seconds = Number(timeSpan[3] ?? 0);
    const fraction = timeSpan[4] ? Number(`0.${timeSpan[4]}`) : 0;
    if (minutes > 59 || seconds > 59) return null;
    return hours * 60 + minutes + (seconds + fraction) / 60;
  }

  const isoDuration = valueText.match(/^P(?:(\d+(?:[.,]\d+)?)D)?(?:T(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)S)?)?$/i);
  if (isoDuration) {
    const toNumber = (part?: string) => Number((part ?? "0").replace(",", "."));
    return toNumber(isoDuration[1]) * 1440 + toNumber(isoDuration[2]) * 60 + toNumber(isoDuration[3]) + toNumber(isoDuration[4]) / 60;
  }

  const numeric = Number(valueText.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function durationFromRow(row: Cell[], columns: Record<string, number | undefined>, start: Date | null, end: Date | null): number | null {
  const durationValue = cellAt(row, columns.duration);
  if (text(durationValue)) {
    const minutes = parseDuration(durationValue, columns.durationIsMinutes === 1);
    if (minutes !== null) return minutes;
  }
  if (start && end) {
    const delta = (end.getTime() - start.getTime()) / 60_000;
    if (delta >= 0) return delta;
  }
  return null;
}

function classificationFromRow(value: Cell, durationMinutes: number | null): AlarmClassification {
  const normalized = normalize(text(value));
  if (durationMinutes !== null) return durationMinutes >= 40 ? "Incidente" : "Oscilação";
  if (normalized.includes("incidente")) return "Incidente";
  if (normalized.includes("oscil")) return "Oscilação";
  return "Não classificado";
}

function usableRows(matrix: Matrix): Matrix {
  return matrix.filter((row) => row.some((value) => text(value) !== ""));
}

export function parseWorkbook(buffer: ArrayBuffer, fileName: string, requestedSheet?: string): ImportResult {
  const workbook = readInputWorkbook(buffer, fileName);
  const sheetNames = workbook.SheetNames;
  if (sheetNames.length === 0) throw new Error("O arquivo não contém abas de planilha.");
  const sheetName = requestedSheet && sheetNames.includes(requestedSheet) ? requestedSheet : sheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) throw new Error(`Não foi possível abrir a aba “${sheetName}”.`);

  const matrix = usableRows(XLSX.utils.sheet_to_json<Matrix[number]>(worksheet, { header: 1, defval: "", raw: true, blankrows: false }));
  if (matrix.length < 2) throw new Error(`A aba “${sheetName}” não contém cabeçalho e linhas de dados.`);

  const headers = matrix[0].map((value) => text(value));
  const columns: Record<string, number | undefined> = {
    start: findColumn(headers, ["Horário Inicial", "Data/Hora Inicial", "Data de Início", "Início", "Abertura"]),
    end: findColumn(headers, ["Horário Final", "Data/Hora Final", "Data de Fim", "Fim", "Encerramento"]),
    device: findColumn(headers, ["Dispositivo", "Link", "Circuito", "Equipamento"]),
    alarm: findColumn(headers, ["Alarme", "Nome do Alarme", "Evento", "Descrição do Alarme"]),
    sourceType: findColumn(headers, ["TIPO", "Categoria", "Categoria do Alarme", "Tipo do Alarme"]),
    operator: findColumn(headers, ["Operadora", "Carrier", "Provedor"]),
    locality: findColumn(headers, ["Localidade", "Local", "Site", "Cidade", "Unidade"]),
    responsible: findColumn(headers, ["Responsável", "Responsavel", "Atendente", "Reconhecido por", "Acknowledged By"]),
    deviceType: findColumn(headers, ["Tipo de Dispositivo", "Tipo de Equipamento", "Device Type", "Equipment Type"]),
    trap: findColumn(headers, ["Gerado por Trap", "Trap", "Alarme Trap"]),
    ticket: findColumn(headers, ["Ticket", "Incidente", "Chamado", "Protocolo", "Número do Ticket"]),
    comment: findColumn(headers, ["Comentários", "Comentario", "Observação", "Observacoes", "Descrição", "Detalhes"]),
    duration: findColumn(headers, ["DuracaoMinutos", "Duração em Minutos", "Tempo de Indisponibilidade", "Duração", "Tempo no Horário de Análise (H:M:S)"]),
    classification: findColumn(headers, ["Classificação", "Classificacao", "Classification"]),
  };
  const missing: string[] = [];
  if (columns.start === undefined) missing.push("Horário Inicial");
  if (columns.device === undefined) missing.push("Dispositivo");
  if (columns.responsible === undefined) missing.push("Responsável");
  if (columns.duration === undefined && columns.end === undefined) missing.push("DuracaoMinutos ou Horário Final");
  if (missing.length) throw new Error(`Colunas essenciais ausentes na aba “${sheetName}”: ${missing.join(", ")}. Confira o modelo OPERADORAS.xlsx.`);
  columns.durationIsMinutes = columns.duration !== undefined && normalize(headers[columns.duration]) === "duracaominutos" ? 1 : 0;

  const mappedFields: Array<[number | undefined, string]> = [
    [columns.start, "Horário Inicial"], [columns.end, "Horário Final"], [columns.device, "Dispositivo"],
    [columns.alarm, "Alarme"], [columns.sourceType, "TIPO"], [columns.operator, "Operadora"],
    [columns.locality, "Localidade"], [columns.responsible, "Responsável"], [columns.deviceType, "Tipo de dispositivo"],
    [columns.trap, "Origem / trap"], [columns.ticket, "Ticket"], [columns.comment, "Comentário"], [columns.duration, "Duração"], [columns.classification, "Classificação"],
  ];
  const fieldsByColumn = new Map<number, string[]>();
  for (const [index, field] of mappedFields) {
    if (index === undefined) continue;
    fieldsByColumn.set(index, [...(fieldsByColumn.get(index) ?? []), field]);
  }
  const detectedColumns: DetectedColumn[] = headers.map((header, index) => ({
    column: header || `Coluna ${index + 1}`,
    field: fieldsByColumn.get(index)?.join(" / ") ?? null,
  }));

  const warnings: string[] = [];
  if (columns.sourceType === undefined) warnings.push("A coluna TIPO não foi encontrada; a categoria será determinada pelo prefixo LINK no campo Dispositivo.");
  if (columns.operator === undefined) warnings.push("A coluna Operadora não foi encontrada; os registros serão marcados como “Não informada”.");
  if (columns.locality === undefined) warnings.push("A coluna Localidade não foi encontrada; os registros serão marcados como “Não informada”.");
  if (columns.alarm === undefined) warnings.push("A coluna Alarme não foi encontrada; será exibido o nome do dispositivo como identificação do evento.");
  if (columns.duration === undefined) warnings.push("DuracaoMinutos não foi encontrada; a duração será calculada por Horário Final menos Horário Inicial.");

  const records: AlarmRecord[] = [];
  let undatedRows = 0;
  let rowsWithoutDuration = 0;
  let rowsUsingDeviceFallback = 0;
  const dataRows = matrix.slice(1);

  dataRows.forEach((row, index) => {
    const raw: Record<string, unknown> = {};
    headers.forEach((header, columnIndex) => {
      if (header) raw[header] = row[columnIndex] ?? "";
    });

    const startedAt = parseDate(cellAt(row, columns.start));
    const endedAt = parseDate(cellAt(row, columns.end));
    const rawDevice = text(cellAt(row, columns.device));
    const hasDeviceIdentifier = Boolean(rawDevice);
    const device = rawDevice || "Dispositivo sem identificação";
    const sourceType = text(cellAt(row, columns.sourceType));
    if (!sourceType) rowsUsingDeviceFallback += 1;
    const durationMinutes = durationFromRow(row, columns, startedAt, endedAt);
    const classification = classificationFromRow(cellAt(row, columns.classification), durationMinutes);
    if (!startedAt) undatedRows += 1;
    if (durationMinutes === null) rowsWithoutDuration += 1;

    records.push({
      id: `${sheetName}-${index + 2}-${device}`,
      sourceRow: index + 2,
      alarm: text(cellAt(row, columns.alarm)) || device,
      device,
      hasDeviceIdentifier,
      sourceType,
      deviceType: text(cellAt(row, columns.deviceType)) || UNKNOWN,
      operator: text(cellAt(row, columns.operator)) || UNKNOWN,
      locality: text(cellAt(row, columns.locality)) || UNKNOWN,
      responsible: text(cellAt(row, columns.responsible)) || "Não reconhecido",
      trap: text(cellAt(row, columns.trap)) || UNKNOWN,
      ticket: text(cellAt(row, columns.ticket)) || "—",
      comment: text(cellAt(row, columns.comment)) || "",
      startedAt,
      endedAt,
      durationMinutes,
      classification,
      raw,
    });
  });

  if (undatedRows) warnings.push(`${undatedRows} linha(s) sem Horário Inicial foram mantidas, mas só aparecem no filtro “Todos os meses”.`);
  if (rowsWithoutDuration) warnings.push(`${rowsWithoutDuration} linha(s) sem duração válida serão listadas, mas não entram no MTTR nem nas somas de indisponibilidade.`);
  if (columns.sourceType !== undefined && rowsUsingDeviceFallback) warnings.push(`${rowsUsingDeviceFallback} registro(s) sem TIPO foram classificados pelo prefixo LINK em Dispositivo.`);

  return {
    records,
    fileName,
    sheetName,
    sheetNames,
    warnings,
    detectedColumns,
    undatedRows,
    rowsWithoutDuration,
    skippedBlankRows: 0,
    totalRows: records.length,
  };
}
