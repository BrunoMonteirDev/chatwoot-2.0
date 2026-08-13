# Bridge Evolution → Chatwoot

Recebe o webhook `messages.upsert` da Evolution e cria mensagens incoming pela
Public API da inbox `Channel::Api` do Chatwoot. Não usa token do navegador.

## Configuração

Copie os valores de `bridge` do `.env.example` para `.env`:

```env
CHATWOOT_BASE_URL=http://localhost:3000
CHATWOOT_ACCOUNT_ID=1
CHATWOOT_API_ACCESS_TOKEN=token-de-um-administrador-da-conta
EVOLUTION_BASE_URL=http://localhost:8080
EVOLUTION_API_KEY=chave-server-side-da-evolution
BRIDGE_PORT=3100
BRIDGE_WEBHOOK_SECRET=um-segredo-longo-e-aleatorio
```

`CHATWOOT_API_ACCESS_TOKEN` é usado apenas para localizar a inbox pelo
`additional_attributes.evolution_instance_name`. A criação de contatos,
conversas e mensagens usa o `inbox_identifier` público da `Channel::Api`.

Inicie com:

```bash
npm run bridge
```

O endpoint é `POST http://SEU_HOST:3100/webhooks/evolution`; configure a
Evolution para enviar somente o evento `messages.upsert` para essa URL e enviar
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
configura `POST /webhooks/evolution` ao criar/conectar a inbox. No fluxo
local/MVP, defina `VITE_BRIDGE_WEBHOOK_SECRET` com o mesmo valor de
`BRIDGE_WEBHOOK_SECRET`. Em produção, configure esse segredo por um BFF, para
não expô-lo no navegador.

O Chatwoot assina esse endpoint com `X-Chatwoot-Timestamp` e
`X-Chatwoot-Signature`. O bridge consulta as secrets das API inboxes usando o
`CHATWOOT_API_ACCESS_TOKEN` server-side e valida o HMAC antes de aceitar o
payload. Somente `message_created` com `message_type: outgoing`,
`private: false`, `content_type: text` e source id `whatsapp:<número>` é
enviado à Evolution por `POST /message/sendText/:instance`, com
`{ "number": "...", "text": "..." }`.

## Deduplicação

O Chatwoot 4.16.2 não aceita `source_id` na Public API de criação de mensagens.
Por isso o bridge persiste `instance:messageId` em
`bridge/data/evolution-message-ids.json`, ignorado pelo Git. O arquivo é
atualizado atomicamente após o Chatwoot confirmar a criação; também há uma trava
em memória para webhooks simultâneos. Para alta disponibilidade, o próximo
passo é trocar este store por Redis ou banco compartilhado.
