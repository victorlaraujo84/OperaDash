# KNIME do OperaDash

Esta pasta reúne os arquivos necessários para reproduzir a preparação das fontes do painel.

- `workflows/` guarda os workflows exportados do KNIME, como arquivos `.knwf`.
- `scripts/` guarda os scripts chamados pelos workflows.
- `config/` guarda parâmetros e exemplos de configuração sem credenciais.

Para cada workflow, registre a versão do KNIME, as extensões necessárias, os arquivos de entrada esperados e a sequência de execução. Gere CSVs de Alertas, Incidentes e Inventário e um XLSX de Subtarefas conforme os modelos em **Fontes e configurações** do OperaDash. Exporte a chave da subtarefa, a data de criação, o motivo em **Motivo do alarme** e a categoria em **TIPO** (`LINK` ou `DISPOSITIVO`), o tipo de unidade em **TIPO_UND** e o nome da unidade em **UND_NOME**. Inclua a chave ou o ID do incidente pai para a correlação.

Antes de exportar um workflow, remova credenciais e dados em cache. Mantenha tokens, senhas e planilhas operacionais fora do Git.
