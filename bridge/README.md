# Bridge WhatsApp → Chatwoot

Recebe o webhook `messages.upsert` da Evolution e cria mensagens incoming pela
Public API da inbox `Channel::Api` do Chatwoot. Não usa token do navegador.

Também atende a Meta Cloud API para inboxes `official` e `hybrid`; a Evolution
continua sendo o transport da sessão Web.

## Configuração

Copie os valores de `bridge` do `.env.example` para `.env`:

```env
CHATWOOT_BASE_URL=http://localhost:3000
# Opcional, somente compatibilidade com instalações antigas de uma conta.
CHATWOOT_ACCOUNT_ID=
# Opcional em instalações antigas. Em produção o bridge cria a própria
# credencial técnica automaticamente dentro da rede Docker.
CHATWOOT_API_ACCESS_TOKEN=
EVOLUTION_BASE_URL=http://localhost:8080
EVOLUTION_API_KEY=chave-server-side-da-evolution
BRIDGE_PORT=3100
BRIDGE_WEBHOOK_SECRET=um-segredo-longo-e-aleatorio
```

`CHATWOOT_ACCOUNT_ID` não é necessário em uma instalação multi-conta. Para
operações novas, o bridge identifica a conta pelo webhook do Chatwoot e grava
o vínculo **conta + inbox + sessão WAHA**. O valor, se informado, é apenas
fallback de migração para sessões antigas.

Em produção o bridge ignora um `CHATWOOT_API_ACCESS_TOKEN` antigo e usa sua
credencial interna automática. Para manter temporariamente o comportamento
antigo, defina `BRIDGE_USE_LEGACY_CHATWOOT_TOKEN=true`; nesse caso o token deve
pertencer a um usuário técnico administrador em todas as contas. A criação de contatos,
conversas e mensagens usa o `inbox_identifier` público da `Channel::Api`.

Inicie com:

```bash
npm run bridge
```

O endpoint é `POST http://SEU_HOST:3100/webhooks/evolution`; configure a
Evolution para enviar `messages.upsert`, `messages.edited`, `messages.delete`,
`groups.upsert`, `groups.update` e `group-participants.update` para essa URL e enviar
o mesmo segredo no cabeçalho `x-bridge-secret` (ou `Authorization: Bearer`).
No Linux deste ambiente, o container Rails alcança o host no gateway
`172.21.0.1`; a conectividade foi verificada na porta 3100. Para usar a rede
privada local, acrescente `SAFE_FETCH_ALLOW_PRIVATE_NETWORK=true` ao `.env` do
Chatwoot e reinicie `rails` e `sidekiq`. Isso é uma configuração local do
Chatwoot, não exige alteração do `docker-compose` nem de seu código. Em outros
hosts, consulte a rota padrão do container (`ip route`) em vez de assumir este
IP. `host.docker.internal` não é resolvido pela instalação Linux atual.

## Saída Chatwoot → Evolution

Defina também no `.env` do frontend `VITE_BRIDGE_PUBLIC_URL` com a URL do
bridge. Em produção ela deve ser HTTPS; em modo Vite de desenvolvimento, HTTP
é permitido, por exemplo `http://172.21.0.1:3100`. Ao criar uma inbox Evolution, a UI salva automaticamente
`<VITE_BRIDGE_PUBLIC_URL>/webhooks/chatwoot` em `Channel::Api.webhook_url`.
Inboxes existentes são atualizadas ao abrir sua tela de configuração.

Para que a Evolution também entregue mensagens recebidas ao bridge, a UI
configura `POST /webhooks/evolution` ao criar/conectar a inbox. A UI não recebe
o segredo: operações administrativas passam pela sessão autenticada do
Chatwoot e o bridge guarda `BRIDGE_WEBHOOK_SECRET` exclusivamente no servidor.

O Chatwoot assina esse endpoint com `X-Chatwoot-Timestamp` e
`X-Chatwoot-Signature`. Em produção o bridge consulta as secrets das API
inboxes com uma conta técnica criada automaticamente dentro da rede Docker e
valida o HMAC antes de aceitar o payload. `CHATWOOT_API_ACCESS_TOKEN` só é
necessário como compatibilidade com instalações antigas. Mensagens, anexos e
replies são roteados pelo transport da mensagem.
Na Evolution v2, editar usa `POST /chat/updateMessage/:instance` e apagar para
todos usa `DELETE /chat/deleteMessageForEveryone/:instance`; o Chatwoot só é
atualizado após a confirmação do provider. Meta Cloud não anuncia essas duas
capabilities no cenário atual, portanto não há falso sucesso nem fallback.

## Deduplicação

O Chatwoot 4.16.2 não aceita `source_id` na Public API de criação de mensagens.
Por isso o bridge persiste `instance:messageId` em
`bridge/data/evolution-message-ids.json`, ignorado pelo Git. O arquivo é
atualizado atomicamente após o Chatwoot confirmar a criação; também há uma trava
em memória para webhooks simultâneos. Em produção, configure
`BRIDGE_REDIS_URL` e `BRIDGE_ENCRYPTION_KEY`: deduplicação, identidade,
configuração Meta, sessões de onboarding e staging de histórico passam a usar
Redis compartilhado; conteúdo e credenciais são cifrados antes de persistir.

## Operação em produção

Use HTTPS para frontend, bridge e Chatwoot. Defina `BRIDGE_ALLOWED_ORIGINS` com
as origens exatas do frontend (sem `*`), `META_APP_SECRET` para que callbacks
Meta sejam obrigatoriamente verificados por `X-Hub-Signature-256`, uma URL
Redis autenticada e `BRIDGE_ENCRYPTION_KEY` exclusiva. O bridge expõe
`/health` (processo/métricas) e `/ready` (Chatwoot e Redis). Endpoints de
configuração, onboarding, importação e reactions possuem limite de taxa; os
webhooks não são limitados para evitar perda de mensagens.

Mídia é limitada por `BRIDGE_MAX_MEDIA_BYTES` (32 MiB por padrão). Downloads
Meta aceitam somente URLs HTTPS dos domínios de mídia Meta; URLs do navegador
nunca são usadas como destino de download do bridge.

## Cadastro Incorporado Meta (Embedded Signup v4)

Além da configuração manual, a tela de inbox abre o Facebook Login for
Business com uma Configuration ID de Embedded Signup v4. Configure somente no
processo do bridge:

```env
META_GRAPH_VERSION=v22.0
META_APP_ID=seu-app-id
META_APP_SECRET=segredo-do-app
META_EMBEDDED_SIGNUP_CONFIG_ID=configuration-id-da-meta
META_WEBHOOK_VERIFY_TOKEN=token-de-verificacao-do-webhook
META_EMBEDDED_SIGNUP_SESSION_TTL_SECONDS=600
```

`META_APP_SECRET`, authorization codes e access tokens não são entregues ao
navegador nem gravados nos atributos da inbox. O endpoint público
`GET /meta/embedded-signup/config` devolve apenas App ID, Configuration ID e
versão Graph. Os endpoints de início/conclusão exigem a mesma autenticação de
bridge já usada neste MVP; em produção, coloque-os atrás de um BFF/sessão de
usuário. Não existe segredo de webhook em `VITE_*`.

Fluxo:

1. O bridge cria uma sessão aleatória, curta e vinculada a uma inbox existente
   (ou à intenção de criar uma inbox).
2. O navegador recebe apenas essa sessão e a configuração pública, abre o SDK
   da Meta e encaminha o `code` de volta ao bridge.
3. O bridge troca o code com `META_APP_SECRET`, valida WABA e Phone Number ID,
   tenta inscrever o app em `/{WABA_ID}/subscribed_apps` e guarda o token
   somente no bridge (Redis cifrado em produção, arquivo local em desenvolvimento).
4. Só então a UI grava os identificadores públicos em `additional_attributes`.
   Em uma inbox Evolution existente isso adiciona `meta_cloud` e resulta em
   modo `hybrid`, sem criar outra inbox.

No painel Meta, crie um app Business, adicione o produto WhatsApp, configure
Facebook Login for Business/Embedded Signup com a Configuration ID v4, inclua
o domínio HTTPS da aplicação em domínios permitidos, cadastre
`https://SEU_BRIDGE/webhooks/meta` no webhook do produto WhatsApp, informe o
verify token acima e assine o campo `messages`. O app precisa das permissões
WhatsApp/Business exigidas pela Meta para administrar a WABA e inscrever o
app. Se a inscrição do webhook falhar, a configuração fica `pending` em vez
de ser exibida como conectada; corrija permissões/configuração no painel Meta
e execute "Conectar/reconectar WhatsApp Business" novamente.

O modo de onboarding `coexistence` já existe apenas na sessão interna para a
evolução futura. Esta etapa não solicita recursos de coexistência nem importa
histórico.

## Coexistência com WhatsApp Business App

Coexistência é distinta do modo híbrido deste projeto: coexistência significa
**Meta Cloud API + WhatsApp Business App** no mesmo número; híbrido significa
**Meta Cloud API + Evolution**. Os dois podem existir na mesma inbox.

Para iniciar coexistência, a interface usa o `featureType`
`whatsapp_business_app_onboarding` exigido pela Meta. O bridge só persiste
`meta_onboarding_mode=coexistence` quando recebe o evento oficial
`FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING`; a escolha inicial da UI sozinha não
é suficiente. O evento standard continua sendo `FINISH`.

No App Dashboard, além de `messages`, assine os campos `history`,
`smb_message_echoes` e `account_update`. Eles são usados respectivamente para
histórico autorizado/recusado, mensagens enviadas pelo WhatsApp Business App e
offboarding/reconexão. A Meta exige que o cliente tenha WhatsApp Business app
compatível e que o integrador seja Solution Partner ou Tech Provider.

Os lotes `history` são primeiro staged de forma separada do realtime. A ação
**Sincronizar** os importa em batches idempotentes para a conversa existente,
preservando `meta:<wamid>`, timestamp, direção, status, resposta e mídia
quando ainda está disponível. A inserção Rails é silenciosa: não gera unread,
automação, notificação, webhook de saída nem reposiciona uma conversa por
histórico antigo. Em produção, o staging é Redis cifrado; em desenvolvimento,
o arquivo `BRIDGE_META_HISTORY_FILE` continua como fallback.

`smb_message_echoes` é a fonte oficial para novas mensagens enviadas pelo
cliente no WhatsApp Business App ou dispositivo vinculado após coexistência.
Essas mensagens são criadas como `outgoing` com `meta_origin=business_app` e
`source_id=meta:<wamid>`, portanto não retornam ao transport Meta. Eventos de
edit/revoke recebidos nesse campo ainda não são aplicados localmente.

Em mudança de aparelho ou novo registro, `ACCOUNT_OFFBOARDED` deixa a Meta da
inbox como desconectada/reconexão necessária, sem apagar credenciais ou inbox.
`ACCOUNT_RECONNECTED` restaura o estado conectado. A Meta informa que a
reonboarding ocorre em segundo plano; o bridge não desregistra o aplicativo e
não força migração do número.
