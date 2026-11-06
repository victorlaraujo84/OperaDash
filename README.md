# OperaDash — padrão Solor

Aplicação local em React + TypeScript com navegação no padrão visual Solor. Inclui Visão geral, Links, Dispositivos, Indicadores ITSM, Inventário, Análise IA e Fontes e configurações.

## Executar

Requer Node.js 24+ e pnpm 11.25.0.

- Instalar: pnpm install --frozen-lockfile
- Abrir: pnpm dev — http://localhost:4173
- Verificar: pnpm test e pnpm build
- Extensão Chrome: pnpm package:extension

## Fontes e correlação

Importe em Fontes e configurações: Alertas (AlarmReport do TelcoManager), Incidentes (NOC SOLOR do Jira), Subtarefas (NOC SUBTAREFAS) e, opcionalmente, Inventário. CSV e XLSX são aceitos. O importador reconhece UTF-8/Windows-1252, vírgula/ponto e vírgula/tabulação, comentários multilinha e o preâmbulo/total do TelcoManager.

As subtarefas devem trazer Motivo do alarme (inclusive Campo personalizado (Motivo do alarme)) e chave ou ID do pai. O ID pai requer ID da item na fonte de incidentes. Relações genéricas e comentários não substituem parentesco explícito nem motivo estruturado. Relações contraditórias ficam fora da cobertura confirmada.

O ITSM usa o período do alerta para selecionar os incidentes e suas subtarefas; sem alertas, usa a criação do incidente. Os gráficos contam subtarefas únicas com motivo e incidentes distintos por motivo. Motivos podem se sobrepor; a duração do alerta nunca é multiplicada pela quantidade de subtarefas. A tabela permite conferir também tickets fora do recorte/sem vínculo.

Os três CSVs fornecidos para validação resultaram em 51.550 alertas e 10.000 registros em cada fonte Jira. Os anexos de subtarefas não contêm motivo ou pai; a ferramenta apresenta essa lacuna, sem inferir causas. Contagens de 10.000 linhas recebem aviso de possível limitação da exportação.

Os arquivos operacionais permanecem no navegador (IndexedDB), podem ser removidos na interface e são ignorados pelo Git. Nenhum arquivo de entrada foi incluído no repositório. A IA web mantém os prompts e oferece conexão DeepSeek opcional; provedores da extensão mantêm os consentimentos existentes.

Em Fontes e configurações, adicione o logo da empresa (PNG/JPG/WebP até 2 MB), troque ou remova. A imagem fica somente no navegador. Não existe login simulado.

## Ajustes de colunas e visualização

Após importar, abra o mapeamento da fonte, mantenha os padrões ou selecione outras colunas e clique em Aplicar mapeamento. É possível escolher a coluna pela posição quando existem cabeçalhos repetidos, desativar campos e restaurar os padrões. O mapeamento é salvo com o arquivo; remapear preserva os filtros ativos. Um CSV de alertas com cabeçalhos desconhecidos pode ser configurado antes de liberar a análise.

No inventário, clique nos cabeçalhos para alternar ordem crescente e decrescente por quantidade ou disponibilidade; percentuais não calculáveis ficam no fim. Os rankings exibem nomes completos e comparações expansíveis. O histórico Mês a mês ignora somente mês/data selecionados e mantém os demais filtros; o gráfico principal continua no recorte.

## DeepSeek API no site

Em Análise IA, informe sua chave e conecte para carregar o catálogo de modelos. Escolha o modelo e autorize o envio do resumo agregado antes de clicar em Analisar com DeepSeek. A chave permanece somente na memória da seção; ao desconectar ou sair, ela é descartada. A geração pode consumir créditos da conta DeepSeek. O relatório pode ser baixado em Markdown. Falhas de autenticação, saldo, limite, conexão/CORS e tempo de resposta são apresentadas na interface.

Integração baseada nos endpoints oficiais [Models](https://api-docs.deepseek.com/api/list-models/) e [Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/). Sem chave real fornecida, a validação utiliza respostas sintéticas e verifica o contrato de HTTP, sem consumir créditos.

## Documentação da base preservada


Dashboard em português para análise de alarmes NOC, inventário e tickets ITSM. Pode ser usado no Preview Web ou instalado como extensão Chrome MV3.

## Uso e privacidade

Importe um arquivo `.xlsx` de alarmes; opcionalmente, carregue arquivos independentes de ITSM e de inventário. Todos os workbooks são lidos e processados no navegador; não são enviados a um servidor. Os arquivos importados são persistidos no IndexedDB deste navegador e restaurados ao reabrir; a remoção na interface apaga a cópia local. Se a nova planilha de alarmes for inválida, a análise anterior é removida e a interface mostra o erro.

O painel foi reorganizado com uma **sidebar recolhível** chamada **Arquivos e IA**: nela se carregam as três fontes, escolhem-se as abas, mapeiam-se as colunas do inventário, consultam-se os campos identificados e configuram-se os provedores de IA. Para cada arquivo, a seção **Colunas…** mostra todos os cabeçalhos encontrados, o campo operacional que o parser associou a cada cabeçalho, a planilha/aba e a contagem de linhas. A área principal fica dedicada a filtros, indicadores, rankings e alarmes.

O primeiro período selecionado é o mês-calendário anterior ao mês do registro válido mais recente da categoria aberta (Links quando houver alarmes classificados como links; caso contrário, Dispositivos), mesmo quando não há alarmes nesse mês. Os filtros de período, intervalo, operadora, localidade, responsável, tipo de dispositivo, `TIPO`, origem/trap, status/responsável ITSM e busca textual atualizam os indicadores, gráficos, rankings, tabela e exportação CSV.

## Abas e classificação

Quando a coluna `TIPO` está preenchida, valores que começam com `LINK` (ignorando espaços iniciais e maiúsculas/minúsculas) vão para **Links**; os demais, para **Dispositivos**. Se `TIPO` não existir ou estiver vazio em uma linha, usa-se como fallback `Dispositivo` começando por `LINK`.

As abas têm os mesmos indicadores, filtros compartilhados, busca, gráficos, rankings TOP 5, tabela paginada e exportação. O filtro `TIPO` exibe apenas os valores da aba ativa e é limpo ao alternar categoria; os demais filtros permanecem. Quando um arquivo ITSM está carregado, a tabela exibe **Técnico responsável** com base no ticket vinculado; casos sem vínculo não recebem atribuição por inferência.

## Indicadores e visualizações

Os dados são classificados pela coluna **Classificação**, com regra canônica baseada em `DuracaoMinutos`: **Incidente** quando a duração é maior ou igual a 40 minutos e **Oscilação** quando é menor que 40 minutos. As abas operacionais **Links** e **Dispositivos**, incluindo disponibilidade, MTTR, MTFB, rankings, gráfico anual, tabela e exportação, consideram somente Incidentes. A aba **Indicadores ITSM** preserva o recorte completo para mostrar a volumetria de tickets e as faixas de oscilações.

- **Alarmes no período:** registros que correspondem aos filtros da categoria ativa.
- **MTTR médio:** média de `DuracaoMinutos`; se ausente, usa `Horário Final − Horário Inicial`. Como a planilha não contém ID único de incidente, cada linha é uma aproximação de alarme/episódio.
- **MTFB médio por operadora e localidade:** média do intervalo entre `Horário Inicial` de falhas consecutivas dentro de cada par Operadora × Localidade. Cada linha datada é tratada como evento; grupos com menos de duas falhas ficam sem base mensurável. Sem ID único de incidente, é uma aproximação operacional.
- **Percentual de atuação:** percentual de registros cujo responsável contém `noc-solor`, sem diferenciar maiúsculas/minúsculas.
- **Disponibilidade média da operação:** `(24 h × dias de calendário × ativos únicos do inventário na categoria selecionada − indisponibilidade associada) ÷ horas monitoradas`. Cada dia equivale a 24 horas por ativo: setembro tem 720 h/ativo e agosto, 744 h/ativo. Sem operadora ou localidade selecionada, o denominador usa todos os ativos únicos da categoria ativa. Com operadora, localidade ou ambas selecionadas, usa somente a seleção correspondente no inventário. É necessário importar inventário; o percentual é ocultado quando a dimensão selecionada não estiver mapeada ou quando houver ativos ausentes/conflitantes dentro do escopo selecionado.
- **Indisponibilidade líquida:** permanece disponível no contexto analítico interno para comparações e relatório IA, mas não é exibida como indicador nas abas operacionais Links e Dispositivos.
- **Flapping · oscilações:** é exibido exclusivamente na aba **Indicadores ITSM**, considerando alarmes com duração inferior a 40 minutos e destaque para ativos com pelo menos quatro ocorrências em uma janela móvel de duas horas. A regra respeita o recorte e os filtros atuais.
- **Tickets por técnico:** TOP 5 de responsáveis com tickets ITSM únicos conciliados somente aos alarmes datados que atendem a todos os filtros ativos, inclusive categoria, período, operadora, localidade, responsáveis, tipo, origem/trap, filtros ITSM e busca. A data do alarme (`Horário Inicial`), não `Criado` no ITSM, define a inclusão. A base ITSM completa é usada apenas como catálogo para a conciliação. Cada chave única conta uma vez; duplicatas usam a linha com `Atualizado(a)` mais recente e, em empate, a última linha. Tickets sem chave, não encontrados ou sem match ITSM único não são atribuídos; tickets sem responsável vão para “Sem responsável atribuído”. O resumo informa duplicatas, alarmes sem match único e tickets sem chave. Na tela, esse ranking fica após os gráficos e imediatamente antes de **Alarmes do período**.
- **Motivo da indisponibilidade:** gráfico de rosca no relatório ITSM usando tickets únicos conciliados. A coluna `Motivo` é priorizada; no modelo padrão `ITSM-II.xlsx`, quando ela não existe ou está vazia, a coluna `Tipo de item` valida a classificação, como `Evento - Link de comunicação`. Valores sem classificação e categorias fora dos sete principais são consolidados em **Outros**.
- **TOP 5:** na aba Links, links por indisponibilidade somada; na aba Dispositivos, dispositivos por indisponibilidade somada; em ambas, localidades por indisponibilidade e operadoras por alarmes e duração acumulada.
- **MTFB segmentado:** tabela ordenada pelo menor intervalo médio, com Operadora, Localidade, falhas, intervalos observados e MTFB. Todos os filtros do recorte são aplicados.
- **Atuação por período do dia:** usa `Horário Inicial` e compara responsáveis contendo `noc-solor` em quatro faixas: Madrugada `[00:00, 06:00)`, Diurno `[06:00, 12:00)`, Tarde `[12:00, 18:00)` e Noturno `[18:00, 24:00)`. Mostra o número de alarmes sem horário válido e, para um recorte mensal, a variação de atuação em pontos percentuais vs. a mesma faixa do mês anterior.
- **Volume ao longo do ano:** contagem mensal por categoria, com seletor de ano e linha da mediana. Cada contagem respeita todos os filtros ativos, inclusive mês/intervalo. A série mostra meses internos sem alarmes correspondentes como zero quando há dados filtrados antes e depois deles; cada mês mostra a variação percentual frente ao mês consecutivo anterior.

## Relatório IA consolidado

A aba **Análise IA** não fica mais limitada à categoria ativa. O contexto agregado enviado ao provedor contém snapshots independentes de **Links**, **Dispositivos**, **ITSM** e **Inventário**, mantendo o recorte e os filtros aplicados. O relatório dá prioridade a **Flapping/oscilação de Links** quando houver ativos com quatro ou mais ocorrências em uma janela móvel de duas horas, sem deixar de comparar a recorrência em Dispositivos, a volumetria/solução do ITSM e a cobertura do inventário.

Na versão online, a aba oferece **Copiar prompt da análise**, **Copiar prompt da apresentação** e conexão opcional com a **DeepSeek API**, usando a chave informada pela pessoa usuária e autorização antes de enviar o resumo. O conteúdo é montado localmente em Markdown e pode ser colado em qualquer IA escolhida pelo usuário. A extensão mantém, separadamente, o fluxo de análise local/online configurável.

O retorno dos provedores habilitados na extensão é solicitado em Markdown como relatório operacional com resumo executivo, comparação entre Links e Dispositivos, impactos quantificados, focos prioritários, plano de ação recomendado e ressalvas de qualidade. O cabeçalho identifica explicitamente o **Relatório consolidado · todas as abas**, que pode ser baixado como `.md`.

Os documentos de alarmes, ITSM e inventário importados são salvos localmente no IndexedDB do navegador, sem upload para o Operadash, e restaurados automaticamente ao reabrir o site ou a extensão. Remover um documento na interface também remove sua cópia local.

Na extensão, o painel **Arquivo SharePoint** aceita um link HTTPS público de um arquivo `.xlsx` compartilhado como **Anyone / Can view**, sem login Microsoft. A permissão do host é solicitada somente após o clique de download; o arquivo precisa ser entregue diretamente como XLSX e é processado localmente. Links de pasta, HTML e páginas de visualização são rejeitados. Como qualquer pessoa com um link `Anyone` pode encaminhá-lo, esse modo não deve ser usado para dados sensíveis; para pasta privada e auditoria, permanece planejada a integração SharePoint privada via Microsoft Graph.

## Comparação com o mês anterior

Quando o filtro é um único mês ou um intervalo contido no mesmo mês, os quatro rankings de alarme e o ranking ITSM comparam, com seta e percentual, a união dos TOP 5 atual e anterior para não esconder quem entrou ou saiu. Cada item mostra posições e valores absolutos dos dois períodos; todos os filtros operacionais selecionados são preservados no mês-base. As faixas de atuação exibem pontos percentuais (p.p.); o resumo do recorte mostra o volume atual vs. mês-base. Em intervalos parciais, a mesma posição do mês anterior é usada, limitada ao último dia válido. “Sem base” aparece se não houver cobertura datada no mês-base ou se houver registros filtrados, mas nenhuma duração válida para um ranking de indisponibilidade. Com cobertura no mês-base e nenhum alarme correspondente aos filtros ativos, a contagem e a indisponibilidade são comparadas como zero. A série anual mantém a comparação entre meses consecutivos. Em recortes de vários meses, os rankings não comparam uma janela ambígua; use o seletor para escolher um mês.

Em “Todos os meses”, o calendário da disponibilidade vai do primeiro ao último mês com `Horário Inicial` válido que permaneça após os filtros ativos. A contagem total usa os ativos únicos do inventário na categoria ativa; se houver filtro de operadora, localidade ou ambos, usa a seleção correspondente no inventário. Os filtros de alarme definem quais registros datados e associados ao inventário entram no numerador; filtros de evento não removem ativos do denominador, pois o inventário não associa esses atributos aos ativos.

## Limitações da base

Na aba Links, duração representa **horas-link por registro**; em Dispositivos, representa **horas-ativo acumuladas**. O inventário atual é assumido completo e constante ao longo do período histórico porque não possui vigência. Alarmes cujo `Dispositivo` não corresponde ao inventário são excluídos do numerador; linhas sem data ou sem identificador real também ficam de fora e aparecem no painel de revisão. Alarmes simultâneos ou repetidos podem superestimar a indisponibilidade; se a soma exceder as horas-ativo, o painel não mostra percentual inválido. Sem identificador único de incidente não é possível calcular MTBF confiável.

## Desenvolvimento Web

Requer Node.js e pnpm. O parser SheetJS 0.20.3 é instalado da distribuição oficial `cdn.sheetjs.com`; o [guia de instalação SheetJS](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/) documenta essa origem.

```bash
pnpm install
pnpm dev
```

Para validar e compilar a saída Web:

```bash
pnpm typecheck
pnpm build
```

## Empacotamento Docker

O Operadash também pode ser executado como um container estático. O `Dockerfile` usa duas etapas: Node.js/Pnpm somente para compilar o frontend e Nginx Alpine para servir o resultado final. Nenhuma chave de IA, planilha ou dado do usuário é incluído na imagem. O processamento continua no navegador, assim como no site publicado.

Para gerar a imagem:

```bash
docker build -t operadash:latest .
```

Para executar diretamente:

```bash
docker run --rm --name operadash -p 8080:80 operadash:latest
```

Abra `http://localhost:8080`. O endpoint `http://localhost:8080/healthz` retorna `ok` e pode ser usado por um balanceador, Kubernetes ou plataforma de container.

Também é possível usar o Compose:

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f operadash
docker compose down
```

O Nginx possui fallback para `index.html`, cache de assets versionados e não-cache para a aplicação e `manus-routes.json`. As integrações Groq, OpenAI-compatible, Jira e SharePoint público continuam sendo chamadas pelo navegador conforme a configuração local do usuário; o container não recebe essas chaves.

## Extensão Chrome

A extensão usa um build independente, com caminhos relativos, fontes e scripts compilados no pacote:

```bash
pnpm package:extension
```

O comando gera `operadash-extension.zip` e a pasta `dist-extension/`. Extraia o ZIP e, no Chrome, abra `chrome://extensions`, habilite **Modo do desenvolvedor**, selecione **Carregar sem compactação** e escolha a pasta extraída. O ZIP inclui os guias e templates de prompt; não inclui o executável llamafile nem os pesos Qwen. Baixe os arquivos necessários antes de ficar offline.

O site foi preparado para publicação permanente no Manus. A política de permissões de rede da extensão continua opt-in: ela não pede acesso externo ao instalar.

## IA local/offline: llamafile + Qwen3-1.7B

Obtenha antes de ficar offline uma versão do [llamafile](https://github.com/Mozilla-Ocho/llamafile) compatível com seu sistema e o GGUF **Qwen3-1.7B Q4_K_M** em [bartowski/Qwen_Qwen3-1.7B-GGUF](https://huggingface.co/bartowski/Qwen_Qwen3-1.7B-GGUF). O arquivo recomendado é `Qwen_Qwen3-1.7B-Q4_K_M.gguf` (aprox. 1,28 GB). Execute o servidor somente em `127.0.0.1:8080` — não use `0.0.0.0`:

```bash
./llamafile -m ./Qwen_Qwen3-1.7B-Q4_K_M.gguf --server --host 127.0.0.1 --port 8080
```

Na extensão, escolha **llamafile · privado e offline**, clique em **Conectar llamafile** e autorize o loopback. O Chrome pode apresentar também uma solicitação de rede local. A extensão usa `/v1/models` e `/v1/chat/completions` no endereço local, com `model: "LLaMA_CPP"`, sem chave. **Analisar período** e as perguntas enviam somente um resumo agregado, sem planilhas ou comentários. Desconectar revoga a permissão da extensão, mas não encerra o processo.

## IA online: modelos Groq e Qwen3.8-27B

Groq é opcional, exige Internet e chave própria; não é necessário para operar o dashboard ou usar a IA local.

1. Crie uma chave em [console.groq.com/keys](https://console.groq.com/keys), selecione **Groq API · online** na sidebar e informe a chave.
2. Clique em **Conectar Groq**. Na extensão, autorize a permissão opcional `https://api.groq.com/*`; no site publicado, a chamada HTTPS é feita diretamente pelo navegador.
3. O painel consulta `GET /openai/v1/models` com a chave. Como essa resposta não declara a capacidade de Chat Completions, o seletor exige `active === true` e cruza IDs com os modelos de texto/chat confirmados no catálogo oficial. A lista atual inclui `llama-3.1-8b-instant`, `llama-3.3-70b-versatile`, `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `minimaxai/minimax-m2.7` (acesso Enterprise) e `qwen/qwen3.8-27b`; modelos Whisper/TTS/Guard e IDs não confirmados são excluídos.
4. Se sua chave listar **`qwen/qwen3.8-27b`**, ele aparece como preferencial e é pré-selecionado na conexão inicial. A Groq classifica o modelo como **Preview**, sujeito a mudanças ou retirada. Se não estiver listado, nenhum modelo alternativo é pré-selecionado: escolha um dos demais IDs ativos e documentados para chat. Ao atualizar o catálogo, a escolha atual é mantida somente se continuar ativa; se desaparecer, é limpa e o painel exige uma nova escolha manual — mesmo que Qwen esteja disponível. A chamada também revalida o catálogo; não há fallback automático entre modelos ou provedores. Somente Qwen recebe `reasoning_effort: "none"`.
5. **Analisar período** é a ação principal e permanece visível; é habilitada quando há dados e provedor conectado (Groq exige também escolha manual do modelo). Na extensão ou no site publicado, a análise envia o resumo pela API `POST /openai/v1/chat/completions`. A interface avisa que a pergunta, o resumo agregado, os valores dos filtros ativos e os nomes dos rankings saem do computador; o termo digitado na busca não é enviado, apenas um sinalizador de busca ativa. Planilhas completas, comentários e linhas brutas não são enviados pelo painel.

A chave pode ser salva localmente quando a opção **Salvar a chave neste navegador** estiver marcada: no site usa `localStorage` e na extensão usa `chrome.storage.local`. Ela nunca vai para o servidor do Operadash, código-fonte ou ZIP e é enviada no cabeçalho `Authorization: Bearer` somente a `api.groq.com`. Desmarque a opção ou clique em **Desconectar** para removê-la. Qwen3.8-27B via Groq é um modelo na nuvem e **não** substitui o Qwen3-1.7B local. Consulte o [catálogo oficial Groq](https://console.groq.com/docs/models) para a disponibilidade atual.

## Prompt executivo

A sidebar permite **Copiar prompt** ou **Baixar .md** para gerar, localmente, uma instrução de apresentação executiva com os filtros e o contexto agregado atuais (até sete slides). Essa ação não chama nenhum provedor. Os prompts completos estão em [`PROMPT_APRESENTACAO_EXECUTIVA.md`](PROMPT_APRESENTACAO_EXECUTIVA.md) e [`PROMPT_IA_LOCAL.md`](PROMPT_IA_LOCAL.md); ambos também são incluídos no ZIP.

## Configuração Groq e MTFB

Consulte [`CONFIGURACAO_GROQ_E_MTFB.md`](CONFIGURACAO_GROQ_E_MTFB.md) para o passo a passo da extensão Chrome, a política de armazenamento local da chave, o endpoint usado e a metodologia do MTFB.

## Testes e validação

```bash
pnpm typecheck
pnpm test:local-ai
pnpm test:availability
pnpm test:month-comparison
pnpm test:inventory-parser
pnpm test:inventory-indicators
pnpm test:mtfb
pnpm test:itsm-indicators
pnpm test:operational-analytics
pnpm test:classification
pnpm test:itsm-dates
pnpm build
pnpm package:extension
```

Os testes da bridge usam `fetch` simulado. Esta sandbox não instalou a extensão em um Chrome real nem executou uma chamada com chave Groq ou um modelo llamafile/GGUF no computador-alvo.


## Indicadores ITSM e conexão Groq

As três últimas colunas do ITSM — **TIPO**, **Operadora** e **Localidade** — são importadas e usadas como evidência adicional no desempate de tickets com a mesma chave ou link interno. A chave primária continua sendo a evidência principal; as dimensões evitam escolher um ticket de outra categoria, operadora ou localidade.

As colunas de data do ITSM aceitam valores Excel nativos e strings, incluindo o formato usado pelo arquivo `02/out/26 2:00 PM`. O parser converte meses em português e anos de dois dígitos, valida datas impossíveis e usa cache de valores repetidos para manter a leitura eficiente em arquivos grandes.

A aplicação possui a aba **Indicadores ITSM**, com volumetria mensal de **Alarmes × Tickets abertos**, cards de resolvidos e tempo médio de solução, distribuição mensal de resolvidos e faixas de alarmes de oscilação até 10, 25 e 40 minutos. O gráfico anual de Links/Dispositivos mantém o cálculo da mediana do volume de alarmes.

Na extensão Chrome, a seleção de Groq abre um **popup de conexão** para informar a chave, validar modelos ativos, escolher o modelo e iniciar a análise do período. A opção **Salvar a chave neste navegador** controla a persistência local; sem ela, a chave permanece somente em memória. A solicitação usa o resumo agregado do dashboard.

Se o llamafile estiver lento, use **Copiar prompt do llamafile** na aba **Análise IA**. O Operadash copia o mesmo conteúdo estruturado da análise — instruções do analista, tema, recorte, filtros e JSON agregado — para colar manualmente no chat do llamafile, sem iniciar uma chamada automática.

### Provedores externos configuráveis

Além do Groq, a aba **Análise IA** agora aceita um **endpoint OpenAI-compatible** informado pelo usuário. Há presets para **OpenAI** (`https://api.openai.com/v1`) e **DeepSeek** (`https://api.deepseek.com/v1`), além de um campo para qualquer serviço que aceite `POST /chat/completions`. Informe endpoint base, modelo e chave; o site usa CORS do provedor e a extensão solicita permissão apenas para o domínio HTTPS configurado. A chave e a configuração ficam no navegador local. Adaptadores nativos para Gemini e Anthropic ficam previstos para a próxima fase, pois usam formatos de requisição diferentes.


### Qualidade do recorte e MTFB estatístico

A seção **Qualidade do recorte** mostra a base filtrada, a cobertura de duração, o estado metodológico da disponibilidade, ativos sem correspondência e a qualidade da amostra MTFB. O MTFB por Operadora × Localidade apresenta média ponderada pelos intervalos, mediana, extremos, quantidade de falhas e intervalos válidos. Amostras pequenas e ausência de base são sinalizadas explicitamente.


### Configuração do Jira ITSM

Na sidebar **Arquivos e IA**, informe a **URL base da busca Jira** do seu ambiente, por exemplo `https://empresa.atlassian.net/issues`. A aplicação normaliza a URL, salva somente essa configuração no navegador e usa o IP do link/dispositivo para montar o JQL. É possível restaurar o exemplo ou colar uma URL de busca existente; parâmetros antigos são removidos antes da nova consulta.


A seção **Qualidade do recorte** fica na sidebar **Arquivos e IA** e pode ser recolhida pelo cabeçalho **AUDITORIA · OCULTAR**, evitando ocupar a área principal durante a leitura dos gráficos.


Na aba **Indicadores ITSM**, o painel **Ofensores de oscilação** lista os ativos com mais alarmes abaixo de 40 minutos, mostrando operadora, localidade, minutos acumulados, média por ocorrência e participação no impacto de oscilação. A ordenação prioriza frequência e permite identificar tanto repetição quanto concentração de duração.


## Novas abas: Inventário e Análise IA

A área principal agora possui cinco visões: **Links**, **Dispositivos**, **Indicadores ITSM**, **Inventário** e **Análise IA**.

- **Inventário** relaciona links por operadora e ativos por localidade, exibindo quantidade de links, quantidade total de ativos, horas monitoradas e disponibilidade média de cada grupo. Também mostra as médias simples das operadoras e localidades com percentual calculável.
- **Análise IA** concentra a conexão local/Groq e exibe a resposta no próprio dashboard. Antes de analisar, selecione um tema: Visão executiva, Disponibilidade e impacto, Ofensores e recorrência, ITSM e atendimento ou Inventário e cobertura. O tema é enviado como orientação junto ao resumo agregado, sem enviar a planilha completa.
- A disponibilidade operacional mantém o período do recorte da categoria mesmo quando uma operadora selecionada não possui alarmes no mês atual; nesse caso o denominador continua visível e o percentual informa ausência de alarmes conciliados, em vez de invalidar o período.
