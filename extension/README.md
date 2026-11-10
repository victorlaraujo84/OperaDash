# Operadash — guia da extensão Chrome

O dashboard, seus gráficos, fontes e parsers ficam dentro do pacote. Alarmes, ITSM e inventário `.xlsx` são processados no navegador. Na sidebar **Arquivos e IA**, abra os detalhes “Colunas…” para ver todos os cabeçalhos detectados, os campos associados e a contagem de linhas. A área principal apresenta indicadores, filtros, rankings e alarmes.

## Instalar

1. Extraia `operadash-extension.zip` para uma pasta local.
2. Abra `chrome://extensions`, habilite **Modo do desenvolvedor** e clique em **Carregar sem compactação**.
3. Selecione a pasta extraída e clique no ícone da extensão.

O dashboard é offline. A opção **llamafile** também funciona sem Internet depois que o binário e o modelo forem instalados. **Groq é uma opção online**, separada e sempre escolhida explicitamente. Não há envio automático nem mudança automática entre provedores.

## Presets de IA e permissões

Além do llamafile e da Groq, a extensão oferece presets para **Ollama** (`127.0.0.1:11434`), **LM Studio** (`127.0.0.1:1234`), **OpenAI**, **DeepSeek** e **OpenRouter**. A configuração personalizada da extensão é armazenada em `chrome.storage.local`; uma configuração legada no `localStorage` é migrada quando o painel é aberto.

Por segurança, a versão distribuída não solicita `https://*/*`. Ela declara apenas os domínios conhecidos dos provedores suportados, os dois serviços locais e os hosts necessários ao futuro login SharePoint. Endpoints corporativos adicionais devem ser incluídos em uma build aprovada pelo administrador.

## SharePoint por link público de arquivo

Na extensão, o painel **Arquivo SharePoint** permite colar um link HTTPS de um arquivo `.xlsx` compartilhado como **Anyone / Can view**, sem login Microsoft. O acesso ao domínio é solicitado somente depois do clique em **Baixar arquivo**, e apenas para o host SharePoint informado. O XLSX é baixado e processado localmente pelo mesmo parser dos uploads; o conteúdo não é enviado ao Operadash.

Este modo aceita **um arquivo**, não uma pasta. Um link de pasta ou uma página de visualização que não entregue o ZIP XLSX diretamente será rejeitado. Qualquer pessoa que possua um link “Anyone” pode encaminhá-lo, portanto não use essa opção para dados sensíveis. Prefira link somente leitura, prazo de expiração e um arquivo sanitizado. Para pasta privada, listagem automática, auditoria por usuário e sincronização incremental, use a futura integração Microsoft Graph com login corporativo.

## llamafile local — Qwen3-1.7B

Antes de ficar offline, obtenha o executável llamafile apropriado ao seu sistema e o GGUF **Qwen3-1.7B Q4_K_M** em [bartowski/Qwen_Qwen3-1.7B-GGUF](https://huggingface.co/bartowski/Qwen_Qwen3-1.7B-GGUF). O nome do arquivo recomendado é `Qwen_Qwen3-1.7B-Q4_K_M.gguf` (aprox. 1,28 GB). O ZIP não contém esses arquivos.

Mantenha o servidor no loopback; não use `0.0.0.0`:

```bash
./llamafile -m ./Qwen_Qwen3-1.7B-Q4_K_M.gguf --server --host 127.0.0.1 --port 8080
```

Na sidebar, selecione **llamafile · privado e offline** → **Conectar llamafile** e autorize o acesso local. O Chrome pode apresentar, além da permissão opcional da extensão, uma confirmação de acesso à rede local. O assistente usa `GET http://127.0.0.1:8080/v1/models` e `POST http://127.0.0.1:8080/v1/chat/completions` com `model: "LLaMA_CPP"`; não usa chave. **Desconectar** revoga o acesso da extensão, mas não para o processo llamafile.

## Groq API online — Qwen3.8-27B preferencial

Groq requer Internet e uma chave de API sua. A opção é independente do provedor local.

1. Crie uma chave no [console Groq](https://console.groq.com/keys), selecione **Groq API · online** na sidebar e informe a chave no campo protegido.
2. Clique em **Conectar Groq** e autorize o host opcional `https://api.groq.com/*`.
3. O Operadash consulta `GET https://api.groq.com/openai/v1/models` com a chave. A resposta oficial contém IDs e `active`, mas não declara a capacidade de Chat Completions. Por isso, o seletor dinâmico exige `active === true` para a chave atual **e** um ID confirmado na lista oficial de modelos de texto/chat. Na lista oficial consultada em 2026-10-07 estão `llama-3.1-8b-instant`, `llama-3.3-70b-versatile`, `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `minimaxai/minimax-m2.7` e `qwen/qwen3.8-27b`. Whisper, TTS, Guard e IDs desconhecidos não são oferecidos para análise conversacional; modelos de Guard são especializados em moderação, não análise NOC. Novos modelos são incluídos somente após confirmação oficial de suporte a chat.
4. Se disponível para a sua chave, **`qwen/qwen3.8-27b`** é destacado e pré-selecionado na conexão inicial. A Groq classifica esse modelo como **Preview**; pode mudar ou ser retirado. Se não aparecer, escolha manualmente um dos outros IDs ativos e documentados para chat. Ao atualizar o catálogo, o modelo escolhido é mantido somente enquanto ativo; se desaparecer, o seletor é limpo e exige nova escolha manual, sem trocar para Qwen ou outro modelo. Antes de cada análise, o worker revalida o catálogo. Apenas Qwen3.8-27B recebe `reasoning_effort: "none"`.
5. **Analisar período** permanece visível como ação principal; após conectar e selecionar um modelo compatível, envia o resumo do recorte atual. Ou digite uma pergunta. **Desconectar** apaga a chave da memória da aba e revoga a permissão; fechar/recarregar a aba também descarta a chave.

## Comparações mensais no dashboard

Em um mês ou intervalo dentro de um único mês, rankings exibem seta, variação percentual, posições e valores absolutos para a união dos TOP 5 atual e anterior, com os mesmos filtros. O ranking de técnicos aparece depois dos gráficos e imediatamente antes de **Alarmes do período**. A atuação por faixa horária é comparada em pontos percentuais; o volume anual mostra as mudanças entre meses consecutivos. Intervalos parciais do mês anterior são limitados ao último dia desse mês. “Sem base” significa falta de registros datados no período anterior ou, para indisponibilidade, falta de duração válida; um recorte coberto que não tem resultados sob os filtros escolhidos é comparado como zero. Em recortes de vários meses, não inventa uma comparação única.

A interface avisa que a pergunta, o resumo agregado, os valores dos filtros ativos e os nomes dos rankings são enviados à Groq; o termo digitado na busca não é incluído, apenas um sinalizador de busca ativa. Planilhas completas, comentários e linhas brutas não são enviados pelo painel. A chave não fica no ZIP, em arquivo ou armazenamento Chrome; ela é enviada somente em `Authorization: Bearer` ao domínio `api.groq.com`. Qwen3.8-27B da Groq é um modelo em nuvem, distinto do Qwen3-1.7B local. Veja o [catálogo oficial Groq](https://console.groq.com/docs/models).

## Prompt executivo e prompts do assistente

Na sidebar, **Copiar prompt** ou **Baixar .md** gera localmente um prompt com o recorte atual e até sete slides. Não chama nenhum serviço. Os templates e mensagens enviados aos provedores estão incluídos junto com a extensão: [prompt executivo](PROMPT_APRESENTACAO_EXECUTIVA.md) e [instruções do assistente](PROMPT_IA_LOCAL.md).

## Privacidade e validação

- Alarmes, ITSM e inventário permanecem no navegador; o llamafile recebe somente contexto agregado via loopback. Groq recebe somente o resumo agregado e a pergunta, se selecionada e conectada pela pessoa usuária.
- Não são consultados CDNs, fontes remotas, serviços de telemetria ou outros endpoints de IA pelo dashboard.
- A compilação, os testes com `fetch` simulado, o manifesto e a integridade do ZIP foram verificados nesta sandbox. A instalação em um Chrome real, a chamada com chave Groq e a execução do modelo na máquina-alvo precisam ser validadas localmente.
- Avisos de licença das fontes IBM Plex estão em `THIRD_PARTY_NOTICES/`.


## Solução de problemas: `Service worker registration failed` (status 15)

O pacote atual declara o worker como módulo ES porque o build local gera `import` estático de um chunk em `assets/`. Se você carregou um ZIP anterior que não tinha `background.type: "module"`, descarte essa cópia e extraia o novo ZIP completo. Em `chrome://extensions`, remova a extensão antiga se ela apontar para outra pasta, escolha **Carregar sem compactação** e selecione a pasta extraída que contém `manifest.json`, `background.js` e `assets/`. Se a extensão já apontar para a mesma pasta que foi substituída, clique em **Recarregar**. O manifesto não pode ser carregado diretamente do ZIP.
