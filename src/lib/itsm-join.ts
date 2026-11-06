import type { AlarmRecord, ItsmIncident, ItsmJoinMatch, ItsmJoinSummary, ItsmLinkField, ItsmSummaryCheck } from "../types/operadora";

interface InternalCandidate {
  ticket: ItsmIncident;
  fields: Set<ItsmLinkField>;
  linkedKeys: Set<string>;
}

const ISSUE_KEY_RE = /(?<![A-Z0-9])([A-Z][A-Z0-9]{1,15}[-_/: ]+\d{1,12})(?![A-Z0-9])/gi;

export function normalizeIssueKey(value: unknown): string {
  return String(value ?? "").trim().toLocaleUpperCase("pt-BR").replace(/\s+/g, "").replace(/[_/:]+/g, "-");
}

export function extractIssueKeys(value: unknown): string[] {
  const text = String(value ?? "");
  const keys: string[] = [];
  for (const match of text.matchAll(ISSUE_KEY_RE)) {
    const key = normalizeIssueKey(match[1]);
    if (key && !keys.includes(key)) keys.push(key);
  }
  return keys;
}

function normalizeWords(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function summaryIsCompatible(device: string, summary: string): boolean {
  const normalizedDevice = normalizeWords(device);
  const normalizedSummary = normalizeWords(summary);
  if (!normalizedDevice || !normalizedSummary) return false;
  if (normalizedDevice === normalizedSummary) return true;
  const minLength = Math.min(normalizedDevice.length, normalizedSummary.length);
  return minLength >= 5 && (normalizedSummary.includes(normalizedDevice) || normalizedDevice.includes(normalizedSummary));
}

function checkSummary(device: string, ticket: ItsmIncident): ItsmSummaryCheck {
  if (!device.trim() || !ticket.summary.trim()) return "not-checked";
  return summaryIsCompatible(device, ticket.summary) ? "compatible" : "different";
}

function dimensionCompatible(record: AlarmRecord, ticket: ItsmIncident): boolean {
  const alarmType = (record.sourceType || record.deviceType || "").trim();
  const ticketType = (ticket.sourceType ?? "").trim();
  const same = (left: string, right: string) => {
    const normalizedLeft = normalizeWords(left);
    const normalizedRight = normalizeWords(right);
    const unknown = new Set(["", "dispositivo", "naoinformada", "naoinformado", "n\u00e3oinformada", "n\u00e3oinformado"]);
    return unknown.has(normalizedLeft) || unknown.has(normalizedRight) || normalizedLeft === normalizedRight;
  };
  return same(alarmType, ticketType)
    && same(record.operator.trim(), (ticket.operator ?? "").trim())
    && same(record.locality.trim(), (ticket.locality ?? "").trim());
}

function addUnique<T>(values: T[], value: T, key: (item: T) => string): void {
  const target = key(value);
  if (!values.some((item) => key(item) === target)) values.push(value);
}

function buildTicketIndexes(tickets: ItsmIncident[]) {
  const primary = new Map<string, ItsmIncident[]>();
  const internal = new Map<string, InternalCandidate[]>();
  for (const ticket of tickets) {
    const key = normalizeIssueKey(ticket.key);
    if (key) {
      const matches = primary.get(key) ?? [];
      addUnique(matches, ticket, (item) => String(item.sourceRow));
      primary.set(key, matches);
    }
    for (const link of ticket.internalLinks) {
      for (const rawKey of link.keys) {
        const normalized = normalizeIssueKey(rawKey);
        if (!normalized) continue;
        const matches = internal.get(normalized) ?? [];
        const existing = matches.find((candidate) => candidate.ticket.sourceRow === ticket.sourceRow);
        if (existing) {
          existing.fields.add(link.field);
          existing.linkedKeys.add(normalized);
        } else {
          matches.push({ ticket, fields: new Set([link.field]), linkedKeys: new Set([normalized]) });
        }
        internal.set(normalized, matches);
      }
    }
  }
  return { primary, internal };
}

function summaryCandidate(candidates: ItsmIncident[], device: string): ItsmIncident | null {
  const matches = candidates.filter((ticket) => summaryIsCompatible(device, ticket.summary));
  return matches.length === 1 ? matches[0] : null;
}

function dimensionCandidate(candidates: ItsmIncident[], record: AlarmRecord): ItsmIncident | null {
  const matches = candidates.filter((ticket) => dimensionCompatible(record, ticket));
  return matches.length === 1 ? matches[0] : null;
}

function corroboratedCandidate(candidates: ItsmIncident[], commentKeys: string[]): ItsmIncident | null {
  const keys = new Set(commentKeys.map(normalizeIssueKey));
  const matches = candidates.filter((ticket) => {
    const ownKey = normalizeIssueKey(ticket.key);
    return ticket.internalLinks.some((link) => link.keys.some((key) => {
      const normalized = normalizeIssueKey(key);
      return normalized !== ownKey && keys.has(normalized);
    }));
  });
  return matches.length === 1 ? matches[0] : null;
}

function candidateKeys(tickets: ItsmIncident[]): string[] {
  return [...new Set(tickets.map((ticket) => ticket.key).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function matchForTicket(
  device: string,
  ticket: ItsmIncident,
  commentKeys: string[],
  candidateTickets: ItsmIncident[],
  status: "matched-key" | "matched-internal",
  matchField: ItsmJoinMatch["matchField"],
  resolution: ItsmJoinMatch["resolution"],
): ItsmJoinMatch {
  return {
    status,
    matchField,
    resolution,
    summaryCheck: checkSummary(device, ticket),
    commentKeys,
    candidateKeys: candidateKeys(candidateTickets.length ? candidateTickets : [ticket]),
    ticket,
  };
}

function matchOneAlarm(record: AlarmRecord, indexes: ReturnType<typeof buildTicketIndexes>): ItsmJoinMatch {
  const commentKeys = extractIssueKeys(record.comment);
  const primaryCandidates: ItsmIncident[] = [];
  for (const key of commentKeys) {
    for (const ticket of indexes.primary.get(key) ?? []) addUnique(primaryCandidates, ticket, (item) => String(item.sourceRow));
  }

  if (primaryCandidates.length === 1) {
    return matchForTicket(record.device, primaryCandidates[0], commentKeys, primaryCandidates, "matched-key", "Chave da item", "unique-key");
  }

  if (primaryCandidates.length > 1) {
    const byDimensions = dimensionCandidate(primaryCandidates, record);
    if (byDimensions) {
      return matchForTicket(record.device, byDimensions, commentKeys, primaryCandidates, "matched-key", "Chave da item", "device-summary");
    }
    const bySummary = summaryCandidate(primaryCandidates, record.device);
    if (bySummary) {
      return matchForTicket(record.device, bySummary, commentKeys, primaryCandidates, "matched-key", "Chave da item", "device-summary");
    }
    const byInternalLink = corroboratedCandidate(primaryCandidates, commentKeys);
    if (byInternalLink) {
      return matchForTicket(record.device, byInternalLink, commentKeys, primaryCandidates, "matched-key", "Chave da item", "internal-link");
    }
    return {
      status: "ambiguous",
      matchField: null,
      resolution: "none",
      summaryCheck: "not-checked",
      commentKeys,
      candidateKeys: candidateKeys(primaryCandidates),
      ticket: null,
    };
  }

  const internalCandidates = new Map<number, InternalCandidate>();
  for (const key of commentKeys) {
    for (const candidate of indexes.internal.get(key) ?? []) {
      const existing = internalCandidates.get(candidate.ticket.sourceRow);
      if (existing) {
        candidate.fields.forEach((field) => existing.fields.add(field));
        candidate.linkedKeys.forEach((linkedKey) => existing.linkedKeys.add(linkedKey));
      } else {
        internalCandidates.set(candidate.ticket.sourceRow, {
          ticket: candidate.ticket,
          fields: new Set(candidate.fields),
          linkedKeys: new Set(candidate.linkedKeys),
        });
      }
    }
  }
  const internalMatches = [...internalCandidates.values()];
  if (internalMatches.length === 1) {
    const candidate = internalMatches[0];
    const field: ItsmLinkField = candidate.fields.has("LinkInterno-1") ? "LinkInterno-1" : "LinkInterno-2";
    return matchForTicket(record.device, candidate.ticket, commentKeys, [candidate.ticket], "matched-internal", field, "unique-internal");
  }
  if (internalMatches.length > 1) {
    const tickets = internalMatches.map((candidate) => candidate.ticket);
    const byDimensions = dimensionCandidate(tickets, record);
    if (byDimensions) {
      const evidence = internalMatches.find((candidate) => candidate.ticket.sourceRow === byDimensions.sourceRow);
      const field: ItsmLinkField = evidence?.fields.has("LinkInterno-1") ? "LinkInterno-1" : "LinkInterno-2";
      return matchForTicket(record.device, byDimensions, commentKeys, tickets, "matched-internal", field, "device-summary");
    }
    const bySummary = summaryCandidate(tickets, record.device);
    if (bySummary) {
      const evidence = internalMatches.find((candidate) => candidate.ticket.sourceRow === bySummary.sourceRow);
      const field: ItsmLinkField = evidence?.fields.has("LinkInterno-1") ? "LinkInterno-1" : "LinkInterno-2";
      return matchForTicket(record.device, bySummary, commentKeys, tickets, "matched-internal", field, "device-summary");
    }
    return {
      status: "ambiguous",
      matchField: null,
      resolution: "none",
      summaryCheck: "not-checked",
      commentKeys,
      candidateKeys: candidateKeys(tickets),
      ticket: null,
    };
  }

  return {
    status: commentKeys.length ? "not-found" : "no-key",
    matchField: null,
    resolution: "none",
    summaryCheck: "not-checked",
    commentKeys,
    candidateKeys: [],
    ticket: null,
  };
}

export function joinAlarmsWithItsm(alarms: AlarmRecord[], tickets: ItsmIncident[]): AlarmRecord[] {
  const indexes = buildTicketIndexes(tickets);
  return alarms.map((record) => ({ ...record, itsmMatch: matchOneAlarm(record, indexes) }));
}

export function getItsmJoinSummary(records: AlarmRecord[]): ItsmJoinSummary {
  const summary: ItsmJoinSummary = { matchedByPrimary: 0, matchedByInternal: 0, ambiguous: 0, notFound: 0, noKey: 0, summaryMismatch: 0 };
  for (const record of records) {
    const match = record.itsmMatch;
    if (!match) continue;
    if (match.status === "matched-key") summary.matchedByPrimary += 1;
    else if (match.status === "matched-internal") summary.matchedByInternal += 1;
    else if (match.status === "ambiguous") summary.ambiguous += 1;
    else if (match.status === "not-found") summary.notFound += 1;
    else summary.noKey += 1;
    if ((match.status === "matched-key" || match.status === "matched-internal") && match.summaryCheck === "different") summary.summaryMismatch += 1;
  }
  return summary;
}

export function itsmMatchLabel(match: ItsmJoinMatch | null | undefined): string {
  if (!match) return "ITSM não carregado";
  switch (match.status) {
    case "matched-key": return "Vinculado por chave";
    case "matched-internal": return "Vinculado por link interno";
    case "ambiguous": return "Ambíguo";
    case "not-found": return "Chave sem ticket";
    case "no-key": return "Sem chave no comentário";
  }
}

export function itsmResolutionLabel(match: ItsmJoinMatch): string {
  if (match.resolution === "device-summary") return "Desempatado por Dispositivo × Resumo";
  if (match.resolution === "internal-link") return "Confirmado por vínculo interno";
  if (match.resolution === "unique-key") return "Chave primária única";
  if (match.resolution === "unique-internal") return "Link interno único";
  return "Sem associação automática";
}
