import { Link2, RotateCcw, Save } from "lucide-react";
import { normalizeJiraIssuesUrl } from "../lib/jira";

interface JiraSettingsProps {
  value: string;
  onChange: (value: string) => void;
}

export function JiraSettings({ value, onChange }: JiraSettingsProps) {
  const normalized = normalizeJiraIssuesUrl(value);
  const valid = Boolean(normalized);
  return (
    <section className="jira-settings panel" aria-label="Configuração da consulta Jira ITSM">
      <div className="panel-heading">
        <div className="panel-heading__icon"><Link2 size={15} /></div>
        <div className="panel-heading__copy"><h2>Consulta Jira ITSM</h2><p>Configure o ambiente que será aberto pelos links dos ativos</p></div>
        <span className={`panel-tag jira-settings__state jira-settings__state--${valid ? "ok" : "error"}`}>{valid ? "ATIVO" : "REVISAR"}</span>
      </div>
      <div className="jira-settings__body">
        <label className="filter-field" htmlFor="jira-issues-url"><span>URL base da busca Jira</span><input id="jira-issues-url" type="url" value={value} onChange={(event) => onChange(event.target.value)} placeholder="https://empresa.atlassian.net/issues" spellCheck={false} /></label>
        <div className="jira-settings__actions"><small>{valid ? `Consultas abrirão em ${normalized}` : "Informe uma URL Jira válida, como https://empresa.atlassian.net/issues."}</small><button className="button button--quiet button--small" type="button" onClick={() => onChange("https://teste.atlassian.net/issues")}><RotateCcw size={13} />Restaurar exemplo</button></div>
        <p className="jira-settings__note"><Save size={12} />A configuração é salva somente neste navegador. O filtro usa o IP do link/dispositivo e o reporter configurado no Operadash; nenhum ticket é criado ou alterado.</p>
      </div>
    </section>
  );
}
