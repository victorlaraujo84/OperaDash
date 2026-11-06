# OperaDash Solor Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Entregar o painel funcional com identidade Solor e fontes CSV distintas para alertas, incidentes e subtarefas.
**Architecture:** Manter React, parsers e indicadores existentes. Acrescentar uma camada de leitura CSV compartilhada, correlação de subtarefas e um shell de navegação Solor.
**Tech Stack:** React, TypeScript, Vite, SheetJS, Recharts.
**Spec:** docs/superpowers/specs/2026-11-06-operadash-design.md

## Global Constraints
Processamento local; nenhum CSV operacional no Git; causas confirmadas somente por campo estruturado; preservar XLSX e recursos da extensão; não simular login.

## Review Focus
CSV com preâmbulo e Windows-1252; cabeçalhos Jira repetidos; relações ambíguas; motivos conflitantes; ausência de fontes e telas menores.

### Task 1: Importação e correlação
Files: src/lib/csv-workbook.ts; src/lib/itsm-parser.ts; src/lib/xlsx-parser.ts; src/lib/itsm-correlation.ts; src/types/operadora.ts; scripts/test-csv-correlation.ts.
- [ ] Testar CSV com acentos, separador, quebras em comentários e preâmbulo; testar parentesco explícito, duplicatas e causas conflitantes, sem contar duração novamente.
- [ ] Implementar leitura compartilhada e metadados de subtarefa; executar testes novos e existentes.

### Task 2: Navegação e apresentação
Files: src/components/SolorShell.tsx; src/components/ItsmCorrelationPanel.tsx; src/App.tsx; src/styles/solor.css.
- [ ] Implementar navegação lateral, visão geral, fontes, estados vazios e três fontes de ITSM; preservar os painéis atuais.
- [ ] Mostrar motivos com cobertura e evidências, filtros por período e busca, exportação de dados correlacionados.
- [ ] Verificar navegação, filtros, importação, persistência e responsividade no navegador.

### Task 3: Entrega
Files: README.md; .gitignore; docs/superpowers/plans/progress.md.
- [ ] Executar testes, typecheck e build web/extensão; revisar alterações.
- [ ] Disponibilizar preview local e registrar limitações de dados. Preparar branch para o repositório privado já localizado.
