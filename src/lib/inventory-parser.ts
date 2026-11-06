import { readInputWorkbook } from './csv-workbook';
import * as XLSX from "xlsx";
import type { AlarmCategory, InventoryAsset, InventoryColumn, InventoryImportResult } from "../types/operadora";

type Cell = unknown;
type Matrix = Cell[][];

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]/g, "");
}

function normalizeValue(value: string): string {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleUpperCase("pt-BR");
}

function cellText(value: Cell): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function findColumn(headers: string[], aliases: string[]): number | undefined {
  const normalized = headers.map(normalizeHeader);
  for (const alias of aliases) {
    const index = normalized.indexOf(normalizeHeader(alias));
    if (index >= 0) return index;
  }
  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);
    const index = normalized.findIndex((header) => header.includes(normalizedAlias) || normalizedAlias.includes(header));
    if (index >= 0) return index;
  }
  return undefined;
}

function categoryOf(host: string, rawCategory: string): AlarmCategory {
  const normalized = normalizeHeader(rawCategory || host);
  return normalized.startsWith("link") || normalized.includes("circuito") || normalized === "wan" ? "links" : "devices";
}

function usableRows(matrix: Matrix): Matrix {
  return matrix.filter((row) => row.some((value) => cellText(value) !== ""));
}

export function parseInventoryWorkbook(
  buffer: ArrayBuffer,
  fileName: string,
  requestedSheet?: string,
  requestedHostColumn?: number,
  requestedCategoryColumn?: number | null,
  requestedLocalityColumn?: number | null,
  requestedOperatorColumn?: number | null,
): InventoryImportResult {
  const workbook = readInputWorkbook(buffer, fileName);
  const sheetNames = workbook.SheetNames;
  if (!sheetNames.length) throw new Error("O inventário não contém abas de planilha.");
  const sheetName = requestedSheet && sheetNames.includes(requestedSheet) ? requestedSheet : sheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) throw new Error(`Não foi possível abrir a aba de inventário “${sheetName}”.`);
  const matrix = usableRows(XLSX.utils.sheet_to_json<Matrix[number]>(worksheet, { header: 1, defval: "", raw: true, blankrows: false }));
  if (matrix.length < 2) throw new Error(`A aba “${sheetName}” precisa ter uma linha de cabeçalho e ao menos uma linha de hosts.`);

  const headers = matrix[0].map(cellText);
  const rows = matrix.slice(1);
  const columns: InventoryColumn[] = headers
    .map((header, index) => ({ index, label: header || `Coluna ${index + 1}`, populatedRows: rows.filter((row) => cellText(row[index])).length }));
  const populatedColumns = columns.filter((column) => column.populatedRows > 0);

  const validColumn = (index: number | undefined) => index !== undefined && columns.some((column) => column.index === index) ? index : undefined;
  const hostAliases = ["Hostname", "Host Name", "Nome do Host", "Nome do Ativo", "Dispositivo", "Host", "Hostname do Host", "Nome", "Asset Name", "Asset", "CI", "Circuito", "Link", "Equipamento", "Ativo"];
  const autoHostCandidate = findColumn(headers, hostAliases);
  const autoHostColumn = populatedColumns.some((column) => column.index === autoHostCandidate) ? autoHostCandidate : undefined;
  const hostColumnIndex = validColumn(requestedHostColumn) ?? validColumn(autoHostColumn) ?? (populatedColumns.length === 1 ? populatedColumns[0].index : null);

  const categoryAliases = ["TIPO", "Tipo de Ativo", "Tipo de Host", "Categoria", "Categoria do Ativo", "Classe", "Tipo de Dispositivo", "Asset Type"];
  const autoCategoryColumn = validColumn(findColumn(headers, categoryAliases)) ?? null;
  const requestedCategory = requestedCategoryColumn === undefined
    ? autoCategoryColumn
    : requestedCategoryColumn === null ? null : validColumn(requestedCategoryColumn) ?? null;
  const categoryColumnIndex = requestedCategory === hostColumnIndex ? null : requestedCategory;

  const localityAliases = ["Localidade", "Cidade", "Municipio", "Município", "City", "Local", "Site", "Regiao", "Região"];
  const autoLocalityColumn = validColumn(findColumn(headers, localityAliases)) ?? null;
  const requestedLocality = requestedLocalityColumn === undefined
    ? autoLocalityColumn
    : requestedLocalityColumn === null ? null : validColumn(requestedLocalityColumn) ?? null;
  const localityColumnIndex = requestedLocality === hostColumnIndex || requestedLocality === categoryColumnIndex ? null : requestedLocality;

  const operatorAliases = ["Operadora", "Operator", "Carrier", "Provedor", "Fornecedor", "ISP", "Telco", "Empresa", "Operadora do Link", "Operadora do Ativo", "Nome da Operadora", "Nome Operadora", "Carrier Name", "Service Provider"];
  const autoOperatorColumn = validColumn(findColumn(headers, operatorAliases)) ?? null;
  const requestedOperator = requestedOperatorColumn === undefined
    ? autoOperatorColumn
    : requestedOperatorColumn === null ? null : validColumn(requestedOperatorColumn) ?? null;
  const operatorColumnIndex = requestedOperator === hostColumnIndex || requestedOperator === categoryColumnIndex || requestedOperator === localityColumnIndex ? null : requestedOperator;

  const hostMap = new Map<string, {
    name: string;
    categories: Set<AlarmCategory>;
    localities: Map<string, string>;
    operators: Map<string, string>;
    localityMissing: boolean;
    operatorMissing: boolean;
  }>();
  let emptyHostRows = 0;
  let duplicateRows = 0;
  let categoryConflicts = 0;
  for (const row of rows) {
    const name = hostColumnIndex === null ? "" : cellText(row[hostColumnIndex]);
    if (!name) {
      emptyHostRows += 1;
      continue;
    }
    const id = normalizeValue(name);
    const rawCategory = categoryColumnIndex === null ? "" : cellText(row[categoryColumnIndex]);
    const category = categoryOf(name, rawCategory);
    const locality = localityColumnIndex === null ? "" : cellText(row[localityColumnIndex]);
    const operator = operatorColumnIndex === null ? "" : cellText(row[operatorColumnIndex]);
    const existing = hostMap.get(id);
    if (existing) {
      duplicateRows += 1;
      if (!existing.categories.has(category)) categoryConflicts += 1;
      existing.categories.add(category);
      if (localityColumnIndex !== null) {
        if (!locality) existing.localityMissing = true;
        else existing.localities.set(normalizeValue(locality), existing.localities.get(normalizeValue(locality)) ?? locality);
      }
      if (operatorColumnIndex !== null) {
        if (!operator) existing.operatorMissing = true;
        else existing.operators.set(normalizeValue(operator), existing.operators.get(normalizeValue(operator)) ?? operator);
      }
    } else {
      const localities = new Map<string, string>();
      const operators = new Map<string, string>();
      if (locality) localities.set(normalizeValue(locality), locality);
      if (operator) operators.set(normalizeValue(operator), operator);
      hostMap.set(id, {
        name,
        categories: new Set([category]),
        localities,
        operators,
        localityMissing: localityColumnIndex !== null && !locality,
        operatorMissing: operatorColumnIndex !== null && !operator,
      });
    }
  }

  const assets: InventoryAsset[] = [...hostMap.entries()].map(([id, asset]) => {
    const localities = [...asset.localities.values()];
    const operators = [...asset.operators.values()];
    return {
      id,
      name: asset.name,
      categories: [...asset.categories],
      operator: operators.length === 1 ? operators[0] : null,
      operatorMissing: asset.operatorMissing,
      operatorConflict: operators.length > 1,
      locality: localities.length === 1 ? localities[0] : null,
      localityMissing: asset.localityMissing,
      localityConflict: localities.length > 1,
    };
  });
  const warnings: string[] = [];
  if (hostColumnIndex === null) warnings.push("Não foi possível identificar a coluna de host automaticamente; selecione-a na lista.");
  if (hostColumnIndex !== null && !assets.length) warnings.push("A coluna de host selecionada não contém identificadores válidos.");
  if (categoryColumnIndex === null) warnings.push("Sem coluna de categoria selecionada: nomes iniciados por LINK são classificados como Links e os demais como Dispositivos.");
  if (operatorColumnIndex === null) warnings.push("Sem coluna de operadora selecionada: a disponibilidade por operadora ficará indisponível, mas o cálculo geral e por localidade continuará disponível.");
  if (localityColumnIndex === null) warnings.push("Sem coluna de localidade selecionada: a disponibilidade para uma cidade específica ficará indisponível.");
  const missingOperatorAssets = operatorColumnIndex === null ? 0 : assets.filter((asset) => asset.operatorMissing || !asset.operator).length;
  const conflictingOperatorAssets = assets.filter((asset) => asset.operatorConflict).length;
  if (missingOperatorAssets) warnings.push(`${missingOperatorAssets} host(s) estão sem operadora completa; a disponibilidade por operadora ficará indisponível até revisar esses registros.`);
  if (conflictingOperatorAssets) warnings.push(`${conflictingOperatorAssets} host(s) aparecem associados a mais de uma operadora; a disponibilidade por operadora ficará indisponível até corrigir o inventário.`);
  const missingLocalityAssets = localityColumnIndex === null ? 0 : assets.filter((asset) => asset.localityMissing || !asset.locality).length;
  const conflictingLocalityAssets = assets.filter((asset) => asset.localityConflict).length;
  if (missingLocalityAssets) warnings.push(`${missingLocalityAssets} host(s) estão sem localidade completa; a disponibilidade por cidade ficará indisponível até revisar esses registros.`);
  if (conflictingLocalityAssets) warnings.push(`${conflictingLocalityAssets} host(s) aparecem associados a mais de uma localidade; a disponibilidade por cidade ficará indisponível até corrigir o inventário.`);
  if (emptyHostRows) warnings.push(`${emptyHostRows} linha(s) sem host foram ignoradas.`);
  if (duplicateRows) warnings.push(`${duplicateRows} linha(s) repetida(s) foram consolidadas; a contagem usa hosts únicos.`);
  if (categoryConflicts) warnings.push(`${categoryConflicts} host(s) repetido(s) aparecem em mais de uma categoria e entram em ambas as contagens por categoria.`);

  return {
    assets,
    columns,
    fileName,
    sheetName,
    sheetNames,
    hostColumnIndex,
    categoryColumnIndex,
    operatorColumnIndex,
    localityColumnIndex,
    totalRows: rows.length,
    uniqueHosts: assets.length,
    duplicateRows,
    emptyHostRows,
    warnings,
  };
}
