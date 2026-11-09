# KNIME do OperaDash

Esta pasta reúne os arquivos necessários para reproduzir a preparação das fontes do painel.

- `workflows/` guarda os workflows exportados do KNIME, como arquivos `.knwf`.
- `scripts/` guarda os scripts chamados pelos workflows.
- `config/` guarda parâmetros e exemplos de configuração sem credenciais.

Para cada workflow, registre a versão do KNIME, as extensões necessárias, os arquivos de entrada esperados e a sequência de execução. Gere os CSVs de Alertas, Incidentes, Subtarefas e Inventário conforme os modelos em **Fontes e configurações** do OperaDash. As subtarefas devem manter a chave ou o ID do incidente pai e o motivo em coluna própria.

Antes de exportar um workflow, remova credenciais e dados em cache. Mantenha tokens, senhas e planilhas operacionais fora do Git.
