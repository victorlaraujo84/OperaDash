import assert from "node:assert/strict";
import { inferSharePointFileName, isSupportedSharePointHost, looksLikeXlsx, parseSharePointFileUrl } from "../src/lib/sharepoint-link";

assert.equal(isSupportedSharePointHost("empresa.sharepoint.com"), true);
assert.equal(isSupportedSharePointHost("empresa.sharepoint.us"), true);
assert.equal(isSupportedSharePointHost("malicioso.example.com"), false);
assert.equal(parseSharePointFileUrl("https://empresa.sharepoint.com/sites/noc/alarmes.xlsx")?.protocol, "https:");
assert.equal(parseSharePointFileUrl("http://empresa.sharepoint.com/alarmes.xlsx"), null);
assert.equal(parseSharePointFileUrl("https://example.com/alarmes.xlsx"), null);
assert.equal(inferSharePointFileName(new URL("https://empresa.sharepoint.com/alarmes.xlsx"), null), "alarmes.xlsx");
assert.equal(looksLikeXlsx(Uint8Array.from([0x50, 0x4b, 0x03, 0x04]).buffer), true);
assert.equal(looksLikeXlsx(Uint8Array.from([0x3c, 0x68, 0x74, 0x6d]).buffer), false);
console.log("OK: hosts SharePoint, HTTPS, nomes e assinatura XLSX validados sem permitir origens arbitrárias.");
