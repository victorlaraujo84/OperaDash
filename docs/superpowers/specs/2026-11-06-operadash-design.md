# OperaDash — adaptação ao padrão Solor

Status: proposta para aprovação.

## Objetivo
Recriar a experiência do OperaDash com a identidade visual do Hub Solor apresentada pelo usuário, preservando as funcionalidades do código-fonte fornecido. As planilhas que serão anexadas orientarão a validação do reconhecimento de campos, dos cálculos e da apresentação das informações.

## Abordagens
1. Evoluir a base React + TypeScript existente (recomendação): reaproveitar parsers, cálculos e testes, reorganizando a interface e separando responsabilidades.
2. Reescrever integralmente: permite outra arquitetura, mas amplia o risco de divergências nos indicadores e o trabalho de validação.

Escolha proposta: evolução da base. Ainda depende de aprovação do usuário.

## Experiência e identidade visual
- Menu lateral azul escuro recolhível, navegação com ícones e destaque da seção ativa.
- Barra superior clara, título/contexto da página e ações relevantes ao painel.
- Fundo cinza claro, cartões brancos, bordas suaves, cantos arredondados e azul como cor principal.
- Tipografia legível, espaçamento consistente e adaptação a telas menores.
- Usar a referência como identidade visual; não adicionar seções de RH, contratos ou contas fictícias.
- Não simular autenticação ou exibir um usuário autenticado sem integração real.

## Organização proposta
Navegação: Visão geral; Links; Dispositivos; Indicadores ITSM; Inventário; Análise IA; Fontes e configurações.

Visão geral: situação das fontes, período analisado, indicadores consolidados, principais ofensores e avisos de qualidade. Diferenciar indicadores sem base de valores iguais a zero.

Páginas operacionais: filtros, indicadores, evolução temporal, rankings e tabela detalhada, com exportação e comparação mensal. Manter filtros coerentes entre gráficos e tabelas.

Fontes e configurações: importação de alarmes, ITSM e inventário, seleção de abas, mapeamento de colunas, diagnósticos e configuração Jira. Exibir origem e atualização das fontes.

## Funcionalidades preservadas
Importação XLSX; classificação de links/dispositivos e incidentes/oscilações; filtros; disponibilidade baseada em inventário; MTTR; intervalo entre falhas; atuação NOC; rankings; comparação mensal; flapping; conciliação ITSM; exportação CSV; prompts de análise e apresentação; persistência local e remoção das fontes; links Jira. Preservar os recursos específicos da extensão no seu build separado.

## Melhorias e limites
- Melhorar hierarquia, estados vazios, mensagens de erro, acessibilidade e clareza dos indicadores.
- Conferir persistência real e corrigir documentação contraditória.
- Documentar fórmulas e aproximações; mudanças na regra de negócio devem ser explícitas e verificadas.
- Separar componentes de apresentação e lógica de dados gradualmente.
- Não enviar planilhas, credenciais ou dados operacionais ao repositório.
- Sem backend, autenticação nova ou integração privada com SharePoint nesta primeira etapa.
- Repositório GitHub privado solicitado; nome proposto: operadash. Hospedagem será tratada separadamente.

## Validação
Executar os testes existentes e a compilação, verificar a interface no navegador e validar os arquivos reais quando fornecidos. Examinar duplicidades, datas, unidades de duração, correspondência dos ativos e tickets, denominador da disponibilidade e consistência dos recortes.

## Pendências
Aprovação desta proposta; anexos das planilhas; sessão GitHub autenticada para criar o repositório privado.

## Atualização: três fontes CSV para ITSM
Requisito recebido: AlarmReport contém os alertas TelcoManager; NOC SOLOR contém os incidentes; NOC SUBTAREFAS contém as subtarefas dos incidentes. As três fontes serão importadas em CSV e mantidas como entidades distintas. Não confundir o tipo de registro Jira com a classificação por duração do alarme.

O importador deve reconhecer delimitador e codificação, ignorar o preâmbulo do TelcoManager e preservar colunas repetidas do Jira, inclusive comentários e relações. Cada fonte terá diagnóstico de linhas, duplicidades, campos disponíveis e cobertura do período.

A correlação deve usar referências explícitas de tickets e relações verificáveis. Associação por ativo e horário, se disponibilizada, será identificada como candidata e não como vínculo confirmado. Exibir vínculos ausentes, ambíguos e registros fora da cobertura das fontes.

Os indicadores ITSM terão volumes separados de alertas, incidentes únicos e subtarefas únicas, cobertura da correlação, cobertura de motivo preenchido, distribuição/Pareto de motivos, evolução temporal e detalhamento da evidência de cada classificação. Contagens de motivos por subtarefa e de incidentes afetados devem ter denominadores explícitos; múltiplas subtarefas não multiplicam a duração do alerta. Motivos conflitantes e ausentes ficam visíveis. O campo estruturado de motivo é a fonte primária; texto de comentários não será convertido silenciosamente em causa confirmada.

Inspeção dos anexos: os CSVs Jira possuem 10.000 registros cada; nenhum inclui cabeçalho de motivo ou pai. Os campos de links disponíveis não mostraram correspondência exata entre chaves de incidentes e subtarefas dos dois anexos. A igualdade das contagens em 10.000 deve ser verificada como possível limite de exportação, sem presumir completude. Há informação útil nos comentários, mas ela não substitui o motivo estruturado solicitado.

Pendente: exportação com Motivo do alarme e chave/ID do incidente pai (ou esclarecimento de qual relação representa o vínculo). O desenvolvimento do importador e das telas poderá contemplar campos ausentes com avisos, sem inventar causas ou relações.

## Ajustes solicitados durante a validação
- Seletores de colunas para alertas, incidentes e subtarefas, mantendo a detecção automática, opção de desativar campo, restaurar padrão e aplicar. Salvar o mapeamento junto ao arquivo e reaplicar ao restaurar a sessão. Permitir corrigir cabeçalhos mesmo quando o parser de alertas ainda não reconheceu os campos obrigatórios.
- Upload local do logo da empresa em PNG, JPG ou WebP, com preview, troca, remoção e persistência local.
- Ordenação crescente/decrescente independente nas tabelas de operadoras e localidades por nome, quantidade e disponibilidade. Valores não calculáveis no fim.
- Conexão opcional com a API DeepSeek no site: chave somente em memória, catálogo de modelos autenticado, autorização explícita antes da geração, resumo agregado e pergunta, relatório exibido e exportável. Nenhum upload de planilha ao provedor. Sem chave real, verificar contrato com respostas sintéticas e informar limite da validação.
- Rankings com nomes completos, valores em destaque, barras proporcionais e comparação mensal expansível, preservando os dados e links Jira.
- Histórico mês a mês com totais e variações, independente do mês e intervalo de datas selecionados; preservar os demais filtros e identificar o escopo na interface. O gráfico principal continua refletindo o recorte selecionado.
- Revisão posterior solicitada: retirar os cartões “Principais motivos das quedas” e “Validação dos motivos” da aba ITSM. Manter os demais indicadores, a correlação e a tabela de evidências.
