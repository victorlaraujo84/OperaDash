import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseInventoryWorkbook } from "../src/lib/inventory-parser";

const workbook = XLSX.utils.book_new();
const worksheet = XLSX.utils.aoa_to_sheet([
  ["Hostname", "Cidade", "Nome da Operadora do Link", "Campo ainda sem dados"],
  ["LINK-SP-01", "São Paulo", "Operadora A", ""],
  ["LINK-SP-02", "", "Operadora A", ""],
]);
XLSX.utils.book_append_sheet(workbook, worksheet, "Inventário");
const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
const result = parseInventoryWorkbook(buffer, "inventario-teste.xlsx");

assert.deepEqual(result.columns.map((column) => column.label), ["Hostname", "Cidade", "Nome da Operadora do Link", "Campo ainda sem dados"]);
assert.equal(result.columns.find((column) => column.label === "Campo ainda sem dados")?.populatedRows, 0, "cabeçalho vazio permanece visível e reporta zero valores");
assert.equal(result.hostColumnIndex, 0, "o host é detectado sem selecionar automaticamente uma coluna vazia");
assert.equal(result.localityColumnIndex, 1, "a coluna de cidade é detectada mesmo com valores incompletos");
assert.equal(result.operatorColumnIndex, 2, "a coluna de operadora é detectada automaticamente mesmo com sufixo no cabeçalho");
assert.equal(result.uniqueHosts, 2);
assert.equal(result.assets[0].operator, "Operadora A");

console.log("OK: cabeçalhos preenchidos e vazios do inventário, contagem e detecção local validados.");
