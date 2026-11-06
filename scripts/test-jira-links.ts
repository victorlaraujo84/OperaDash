import assert from "node:assert/strict";
import { extractIpv4, jiraIssueSearchUrl, normalizeJiraIssuesUrl } from "../src/lib/jira";

assert.equal(extractIpv4("LINK 10.122.216.254"), "10.122.216.254");
assert.equal(extractIpv4("host sem ip"), null);
const url = jiraIssueSearchUrl("10.122.216.254");
assert.ok(url?.includes(encodeURIComponent('textfields ~ "10.122.216.254" AND reporter = 712020:603ea3af-c307-4a52-9ec3-7d07404d3885')));
assert.equal(normalizeJiraIssuesUrl("https://empresa.atlassian.net/issues?jql=antigo"), "https://empresa.atlassian.net/issues");
assert.ok(jiraIssueSearchUrl("10.122.216.254", "https://empresa.atlassian.net/issues")?.startsWith("https://empresa.atlassian.net/issues?jql="));
assert.equal(jiraIssueSearchUrl("LINK-SP-01"), null);
console.log("OK: consultas Jira geradas apenas quando o ativo contém IPv4 e respeitam a URL configurada.");
