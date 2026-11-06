import * as XLSX from "xlsx";
import { readInputWorkbook } from './csv-workbook';
import type { DetectedColumn, ItsmImportResult, ItsmIncident, ItsmInternalLink, ItsmLinkField } from "../types/operadora";
import { extractIssueKeys, normalizeIssueKey } from "./itsm-join";

type Cell = unknown;
type Matrix = Cell[][];

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]/g, "");
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toLocaleString("pt-BR");
  return String(value).trim();
}

function findColumn(headers: string[], aliases: string[]): number | undefined {
  const normalized = headers.map(normalizeHeader);
  for (const alias of aliases) {
    const index = normalized.indexOf(normalizeHeader(alias));
    if (index >= 0) return index;
  }
  return undefined;
}

function cellAt(row: Cell[], index: number | undefined): Cell {
  return index === undefined ? "" : row[index];
}

const MONTH_NUMBERS: Record<string, number> = {
  jan: 1, janeiro: 1, fev: 2, fevereiro: 2, mar: 3, marco: 3, abr: 4, abril: 4,
  mai: 5, maio: 5, jun: 6, junho: 6, jul: 7, julho: 7, ago: 8, agosto: 8,
  set: 9, setembro: 9, out: 10, outubro: 10, nov: 11, novembro: 11, dez: 12, dezembro: 12,
};
const DATE_CACHE = new Map<string, number | null>();
const MAX_DATE_CACHE = 50_000;

function validLocalDate(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): number | null {
  const date = new Date(year, month - 1, day, hour, minute, second);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date.getTime()
    : null;
}

function parseDateString(source: string): number | null {
  const localized = source.match(/^(\d{1,2})[/. -]([a-zá-ú.]+)[/. -](\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (localized) {
    const monthName = localized[2].normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\./g, "").toLocaleLowerCase("pt-BR");
    const month = MONTH_NUMBERS[monthName];
    if (month) {
      const rawYear = Number(localized[3]);
      const year = rawYear < 100 ? 2000 + rawYear : rawYear;
      const hour12 = Number(localized[4]);
      const hour = hour12 % 12 + (localized[7].toLowerCase() === "pm" ? 12 : 0);
      const timestamp = validLocalDate(year, month, Number(localized[1]), hour, Number(localized[5]), Number(localized[6] ?? "0"));
      if (timestamp !== null) return timestamp;
    }
  }
  const brazilian = source.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (brazilian) {
    const rawYear = Number(brazilian[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    return validLocalDate(year, Number(brazilian[2]), Number(brazilian[1]), Number(brazilian[4] ?? "0"), Number(brazilian[5] ?? "0"), Number(brazilian[6] ?? "0"));
  }
  const parsed = new Date(source);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function parseExcelDate(value: Cell): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return new Date(value.getTime());
  if (typeof value === "number" && Number.isFinite(value)) {
    const parts = XLSX.SSF.parse_date_code(value);
    if (!parts) return null;
    const timestamp = validLocalDate(parts.y, parts.m, parts.d, parts.H, parts.M, Math.floor(parts.S));
    return timestamp === null ? null : new Date(timestamp);
  }
  const source = text(value);
  if (!source) return null;
  if (DATE_CACHE.has(source)) {
    const timestamp = DATE_CACHE.get(source)!;
    return timestamp === null ? null : new Date(timestamp);
  }
  const timestamp = parseDateString(source);
  if (DATE_CACHE.size >= MAX_DATE_CACHE) DATE_CACHE.clear();
  DATE_CACHE.set(source, timestamp);
  return timestamp === null ? null : new Date(timestamp);
}

function keysFrom(value: string): string[] {
  const extracted = extractIssueKeys(value);
  if (extracted.length) return extracted;
  const normalized = normalizeIssueKey(value);
  return normalized ? [normalized] : [];
}

export function parseItsmWorkbook(buffer: ArrayBuffer, fileName: string, requestedSheet?: string): ItsmImportResult {
  const workbook = readInputWorkbook(buffer, fileName);
  const sheetNames = workbook.SheetNames;
  if (!sheetNames.length) throw new Error("O arquivo ITSM não contém abas de planilha.");
  const sheetName = requestedSheet && sheetNames.includes(requestedSheet) ? requestedSheet : sheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) throw new Error(`Não foi possível abrir a aba ITSM “${sheetName}”.`);
  const matrix = XLSX.utils.sheet_to_json<Matrix[number]>(worksheet, { header: 1, defval: "", raw: true, blankrows: false })
    .filter((row) => row.some((value) => text(value) !== ""));
  if (matrix.length < 2) throw new Error(`A aba ITSM “${sheetName}” não contém cabeçalho e linhas de dados.`);

  const headers = matrix[0].map(text);
  const columns = {
    key: findColumn(headers, ["Chave da item", "Chave do item", "Issue key", "Chave", "Key"]),
    summary: findColumn(headers, ["Resumo", "Summary"]),
    reason: findColumn(headers, ["Motivo", "Motivo do alarme", "Reason", "Campo personalizado (Motivo do alarme)"]),
    itemType: findColumn(headers, ["Tipo de item", "Tipo do item", "Item type"]),
    responsible: findColumn(headers, ["Responsável", "Responsavel", "Assignee"]),
    link1: findColumn(headers, ["LinkInterno-1", "Link Interno 1", "LinkInterno 1"]),
    link2: findColumn(headers, ["LinkInterno-2", "Link Interno 2", "LinkInterno 2"]),
    status: findColumn(headers, ["Status", "Situação", "Estado"]),
    created: findColumn(headers, ["Criado", "Created"]),
    updated: findColumn(headers, ["Atualizado(a)", "Atualizado", "Updated"]),
    due: findColumn(headers, ["Data limite", "Data de vencimento", "Due date"]),
    resolved: findColumn(headers, ["Resolvido", "Data de resolução", "Resolved"]),
    sourceType: findColumn(headers, ["TIPO", "Tipo", "Categoria"]),
    operator: findColumn(headers, ["Operadora", "Carrier", "Provedor"]),
    locality: findColumn(headers, ["Localidade", "Local", "Site", "Cidade"]),
    parent: findColumn(headers, ['Pai', 'Chave do pai', 'Chave do incidente pai', 'Incidente pai', 'Parent', 'Parent key', 'Parent issue key']),
    issueId: findColumn(headers, ['ID da item', 'ID do item', 'Issue id']),
    parentId: findColumn(headers, ['ID pai', 'Parent id', 'Parent issue id']),
  };
  const mappedFields: Array<[number | undefined, string]> = [
    [columns.key, "Chave do ticket"], [columns.summary, "Resumo"], [columns.reason, "Motivo"], [columns.itemType, "Tipo de item"], [columns.responsible, "Responsável"],
    [columns.link1, "LinkInterno-1"], [columns.link2, "LinkInterno-2"], [columns.status, "Status"],
    [columns.created, "Criado"], [columns.updated, "Atualizado(a)"], [columns.due, "Data limite"], [columns.resolved, "Resolvido"],
    [columns.sourceType, "TIPO"], [columns.operator, "Operadora"], [columns.locality, "Localidade"],
    [columns.parent, 'Incidente pai'],
    [columns.issueId, 'ID do ticket'], [columns.parentId, 'ID do incidente pai'],
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
  if (columns.key === undefined) warnings.push("A coluna Chave da item não foi encontrada; os tickets não podem ser deduplicados nem vinculados por chave e as linhas serão excluídas do ranking.");

  const records: ItsmIncident[] = matrix.slice(1).map((row, index) => {
    const key = text(cellAt(row, columns.key));
    const internalLinks: ItsmInternalLink[] = [];
    const linkColumns: [ItsmLinkField, number | undefined][] = [["LinkInterno-1", columns.link1], ["LinkInterno-2", columns.link2]];
    linkColumns.forEach(([field, column]) => {
      const value = text(cellAt(row, column));
      if (value) internalLinks.push({ field: field as ItsmLinkField, value, keys: keysFrom(value) });
    });
    return {
      key,
      summary: text(cellAt(row, columns.summary)),
      reason: text(cellAt(row, columns.reason)),
      itemType: text(cellAt(row, columns.itemType)),
      sourceType: text(cellAt(row, columns.sourceType)),
      operator: text(cellAt(row, columns.operator)),
      locality: text(cellAt(row, columns.locality)),
      responsible: text(cellAt(row, columns.responsible)),
      status: text(cellAt(row, columns.status)),
      createdAt: parseExcelDate(cellAt(row, columns.created)),
      updatedAt: parseExcelDate(cellAt(row, columns.updated)),
      dueAt: parseExcelDate(cellAt(row, columns.due)),
      resolvedAt: parseExcelDate(cellAt(row, columns.resolved)),
      internalLinks,
      issueId: text(cellAt(row, columns.issueId)),
      parentKey: /^\d+$/.test(text(cellAt(row, columns.parent))) ? '' : normalizeIssueKey(text(cellAt(row, columns.parent))),
      parentId: text(cellAt(row, columns.parentId)) || (/^\d+$/.test(text(cellAt(row, columns.parent))) ? text(cellAt(row, columns.parent)) : ''),
      comments: headers.flatMap((header, column) => /^(coment[aá]rios?|comments?)$/i.test(header) && text(row[column]) ? [text(row[column])] : []),
      relatedKeys: [...new Set(headers.flatMap((header, column) => /link .*item|issue link/i.test(header) ? keysFrom(text(row[column])) : []))],
      sourceRow: index + 2,
    };
  });

  const optionalColumns: [keyof typeof columns, string][] = [
    ["summary", "Resumo"], ["reason", "Motivo"], ["itemType", "Tipo de item"], ["responsible", "Responsável"], ["link1", "LinkInterno-1"], ["link2", "LinkInterno-2"],
    ["status", "Status"], ["created", "Criado"], ["updated", "Atualizado(a)"], ["due", "Data limite"], ["resolved", "Resolvido"],
  ];
  const missing = optionalColumns.filter(([key]) => columns[key] === undefined && !(key === "reason" && columns.itemType !== undefined)).map(([, label]) => label);
  if (missing.length) warnings.push(`Colunas ITSM não encontradas e mantidas em branco: ${missing.join(", ")}.`);
  if (columns.reason === undefined && columns.itemType !== undefined) warnings.push("A coluna Motivo não foi encontrada; a validação do motivo da indisponibilidade usará Tipo de item.");
  if (columns.due !== undefined && records.every((record) => record.dueAt === null)) warnings.push("A coluna Data limite está vazia ou contém datas não reconhecidas em todas as linhas; nenhum prazo foi inferido.");
  const counts = new Map<string, number>();
  for (const record of records) {
    const normalized = normalizeIssueKey(record.key);
    if (normalized) counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  const duplicateKeys = [...counts.values()].filter((count) => count > 1).length;
  if (duplicateKeys) warnings.push(`${duplicateKeys} chave(s) primária(s) aparecem em mais de uma linha; o join usa Resumo e links internos para desempatar, ou marca Ambíguo.`);

  return { records, fileName, sheetName, sheetNames, warnings, detectedColumns, totalRows: records.length };
}
