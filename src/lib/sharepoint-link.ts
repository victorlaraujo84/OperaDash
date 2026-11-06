const SHAREPOINT_HOST_PATTERN = /^(?:[a-z0-9-]+\.)?sharepoint\.(?:com|us|cn|de|mil)$/i;

export function isSupportedSharePointHost(hostname: string): boolean {
  return SHAREPOINT_HOST_PATTERN.test(hostname.trim().toLowerCase());
}

export function parseSharePointFileUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || !isSupportedSharePointHost(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

export function withDownloadHint(url: URL): URL {
  const candidate = new URL(url.toString());
  candidate.searchParams.set("download", "1");
  return candidate;
}

export function inferSharePointFileName(url: URL, contentDisposition: string | null): string {
  const dispositionName = contentDisposition?.match(/filename\*?=(?:UTF-8''|\")?([^\";]+)/i)?.[1];
  if (dispositionName) {
    try {
      const decoded = decodeURIComponent(dispositionName).trim();
      if (decoded) return decoded.replace(/[\\/:*?"<>|]/g, "_");
    } catch {
      // Use the URL fallback below when the header is malformed.
    }
  }
  const lastSegment = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() ?? "").trim();
  return lastSegment.toLowerCase().endsWith(".xlsx") ? lastSegment : "sharepoint-operadash.xlsx";
}

export function looksLikeXlsx(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer.slice(0, 4));
  return bytes.length === 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}
