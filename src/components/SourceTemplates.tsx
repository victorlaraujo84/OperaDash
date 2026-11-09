import { Download, FolderOpen } from "lucide-react";

export const sourceTemplates = [
  {
    label: "Alertas",
    filename: "modelo-alertas.csv",
    rows: [
      ["Alarme", "Dispositivo", "Responsável", "Horário Inicial", "Horário Final", "DuracaoMinutos", "TIPO", "Operadora", "Localidade", "Tipo de Dispositivo", "Gerado por Trap", "Ticket", "Comentários"],
      ["Queda de link", "LINK-EXEMPLO", "noc-solor", "01/10/2026 10:00:00", "01/10/2026 11:00:00", "60", "LINK", "Operadora Exemplo", "Cidade Exemplo", "Roteador", "Não", "INC-1001", "#JIRA:INC-1001#"],
    ],
  },
  {
    label: "Incidentes",
    filename: "modelo-incidentes.csv",
    rows: [
      ["Chave do item", "ID do item", "Resumo", "Tipo de item", "Status", "Responsável", "Criado", "Atualizado", "Resolvido", "Motivo do alarme"],
      ["INC-1001", "10001", "Queda de LINK-EXEMPLO", "Incidente", "Fechado", "Equipe Exemplo", "01/10/2026 10:05:00", "01/10/2026 11:10:00", "01/10/2026 11:10:00", ""],
    ],
  },
  {
    label: "Subtarefas",
    filename: "modelo-subtarefas.csv",
    rows: [
      ["Chave do item", "ID do item", "Chave do incidente pai", "ID pai", "Resumo", "Motivo do alarme", "Status", "Responsável", "Criado", "Atualizado", "Resolvido"],
      ["INC-1002", "10002", "INC-1001", "10001", "Verificar alimentação do LINK-EXEMPLO", "Falha de energia", "Fechado", "Equipe Exemplo", "01/10/2026 10:15:00", "01/10/2026 11:10:00", "01/10/2026 11:10:00"],
    ],
  },
  {
    label: "Inventário",
    filename: "modelo-inventario.csv",
    rows: [
      ["Hostname", "TIPO", "Operadora", "Localidade"],
      ["LINK-EXEMPLO", "LINK", "Operadora Exemplo", "Cidade Exemplo"],
    ],
  },
];

export function sourceTemplateCsv(rows: string[][]) {
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  return "\uFEFF" + rows.map((row) => row.map(quote).join(";")).join("\r\n") + "\r\n";
}

function downloadTemplate(template: (typeof sourceTemplates)[number]) {
  const url = URL.createObjectURL(new Blob([sourceTemplateCsv(template.rows)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = template.filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SourceTemplates() {
  return (
    <section className="panel company-logo-settings" aria-labelledby="source-templates-title">
      <div className="sidebar-source-panel__header">
        <span className="itsm-panel-icon"><Download size={18} /></span>
        <div>
          <span className="section-kicker">PREPARAÇÃO DOS ARQUIVOS</span>
          <h2 id="source-templates-title">Modelos de planilhas</h2>
        </div>
      </div>
      <p>Baixe os modelos CSV com os cabeçalhos reconhecidos. Substitua a linha fictícia pelos seus registros antes de importar.</p>
      <div className="mapping-actions">
        {sourceTemplates.map((template) => (
          <button key={template.filename} type="button" className="button button--quiet" onClick={() => downloadTemplate(template)}>
            <Download size={14} /> {template.label} CSV
          </button>
        ))}
      </div>
      <div className="mapping-actions">
        <a className="button button--quiet" href="https://github.com/victorlaraujo84/OperaDash/tree/codex/solor-redesign/knime" target="_blank" rel="noreferrer">
          <FolderOpen size={15} /> Arquivos KNIME no GitHub
        </a>
      </div>
    </section>
  );
}
