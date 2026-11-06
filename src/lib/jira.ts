export const DEFAULT_JIRA_ISSUES_URL = "https://teste.atlassian.net/issues";
const JIRA_REPORTER = "712020:603ea3af-c307-4a52-9ec3-7d07404d3885";
const IPV4_PATTERN = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/;

export function extractIpv4(value: string): string | null {
  const match = value.match(IPV4_PATTERN);
  return match?.[0] ?? null;
}

export function normalizeJiraIssuesUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    const issuesIndex = parsed.pathname.toLocaleLowerCase("pt-BR").indexOf("/issues");
    const pathname = issuesIndex >= 0 ? parsed.pathname.slice(0, issuesIndex + "/issues".length) : `${parsed.pathname.replace(/\/+$/, "")}/issues`;
    return `${parsed.origin}${pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

export function jiraIssueSearchUrl(value: string, baseUrl = DEFAULT_JIRA_ISSUES_URL): string | null {
  const ip = extractIpv4(value);
  const normalizedBaseUrl = normalizeJiraIssuesUrl(baseUrl) ?? DEFAULT_JIRA_ISSUES_URL;
  if (!ip) return null;
  const jql = `textfields ~ "${ip}" AND reporter = ${JIRA_REPORTER}`;
  return `${normalizedBaseUrl}?jql=${encodeURIComponent(jql)}`;
}
