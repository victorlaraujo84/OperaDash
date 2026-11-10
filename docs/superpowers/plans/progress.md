# Ledger — plano 2026-11-06-operadash-solor.md

Direção aprovada pelo usuário ao solicitar criação conforme o documento.
Base extraída do ZIP original; workspace inicial sem commits e sem remote.
Execução em branch própria no workspace vazio; nenhum trabalho de usuário será sobrescrito.
Interfaces: CSV -> SheetJS workbook -> parsers existentes; metadados ITSM -> painel de correlação; navegação -> vistas existentes.
GitHub contém somente build de extensão. Fonte editável será a do ZIP, com preservação do build remoto.

Task 1: completa. CSV UTF-8/Windows-1252, preâmbulo e total do TelcoManager, aspas escapadas e comentários multilinha; leitura real: 51.550 alertas, 10.000 incidentes, 10.000 subtarefas. Teste CSV/correlação passou.
Task 2: completa. Shell Solor, visão geral, fontes separadas, painel ITSM com motivos, cobertura, série mensal e evidências paginadas. Verificação no navegador com anexos reais, restauração de fontes em nova aba e viewport de 390px sem overflow horizontal.
Final review: revisão independente review_solor. Corrigida seleção de motivos por incidente quando um alerta aponta para vários tickets. Corrigidos pais contraditórios e IDs duplicados, excluídos da cobertura confirmada. Regressões reproduzidas e testes verdes após correção.
Validação: pnpm test = 14/14; pnpm build e pnpm build:extension = sucesso. Aviso não bloqueante de bundle acima de 500 kB permanece da arquitetura existente.
Decisões: manter dados ausentes como pendentes; usar chave ou ID pai explícitos; preservar classificação legada por tipo de ticket com texto que não a apresenta como causa confirmada; usar marca textual Solor até disponibilização do logo oficial.

Solicitações adicionais implementadas: editor de mapeamento manual com padrões, salvar/restaurar/reset; upload/preview/remoção de logo; tabelas de inventário ordenáveis; API DeepSeek opcional no site; rankings com nomes completos e comparação recolhível; histórico mensal independente do período.
Verificação em origem de QA isolada: pai customizado + motivo customizado -> 1 subtarefa vinculada, causa Energia no gráfico; logo e mapeamento persistem após reload. Correção de filtro ITSM verificada no navegador: Fechado permanece após aplicar o mapeamento.
Ordenação no navegador verificada em dados reais: Links desc 128/94/86/14/11; asc 1/1/2/2/2. Histórico mostra janeiro a novembro mantendo um único mês selecionado no gráfico principal.
DeepSeek: endpoints e modelos dinâmicos conforme documentação oficial consultada em 2026-11-06. Contrato testado sem chave real; geração autenticada depende da chave do usuário. Credenciais nunca incluídas nos arquivos do projeto.

Validação final ampliada: 19/19 suítes passaram; builds web e extensão passaram. Revisão independente dos novos recursos não encontrou regressões importantes. Caminhos locais e arquivos de teste/artefatos ignorados no Git e no contexto Docker.
Git local: criação de branch foi bloqueada pela permissão de escrita em .git; a fonte será registrada diretamente pelo conector GitHub em branch de funcionalidade com ancestralidade na main, preservando os arquivos compilados já existentes.

Último ajuste visual solicitado: removidos somente os cartões “Principais motivos das quedas” e “Validação dos motivos”; mantidos a tabela de evidências, a correlação e os demais indicadores.
