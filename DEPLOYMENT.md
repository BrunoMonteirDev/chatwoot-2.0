# Deploy do MVP em VPS

Esta stack mantém Evolution como legado, usa WAHA/GOWS para novas sessões Web e mantém Meta Cloud no bridge. Ela pressupõe que os diretórios `chatwoot/` (backend) e `frontend-chatwoot-whatsapp/` (frontend + bridge) estejam lado a lado na VPS.

## 1. DNS e pré-requisitos

Crie registros A/AAAA para `APP_DOMAIN` e `BRIDGE_DOMAIN` apontando para a VPS. Libere TCP 80 e 443. Instale Docker Engine e Docker Compose v2.

```bash
sudo mkdir -p /opt/chatwoot-stack
sudo chown "$USER":"$USER" /opt/chatwoot-stack
cd /opt/chatwoot-stack
git clone https://github.com/BrunoMonteirDev/chatwoot-backend.git chatwoot
git clone https://github.com/BrunoMonteirDev/chatwoot-2.0.git frontend-chatwoot-whatsapp
cd frontend-chatwoot-whatsapp
./scripts/setup-production.sh
```

Edite `.env.production`. Obrigatórios: domínios, senhas PostgreSQL/Redis, `SECRET_KEY_BASE`, `BRIDGE_ENCRYPTION_KEY`, `BRIDGE_WEBHOOK_SECRET`, `WAHA_API_KEY`, `WAHA_WEBHOOK_SECRET`, conta/token de API do Chatwoot e, quando aplicável, credenciais Meta. Gere segredos com `openssl rand -hex 32`.

Não use `VITE_*` para tokens, API keys ou segredos.

## 2. Subir

```bash
./scripts/deploy.sh
docker compose --env-file .env.production -f docker-compose.production.yml ps
curl -fsS https://$BRIDGE_DOMAIN/health
curl -fsS https://$BRIDGE_DOMAIN/ready
```

O Caddy obtém e renova TLS automaticamente após DNS e portas estarem corretos. O frontend preserva rotas SPA, inclusive `/app/accounts/<account>/inbox/<inbox>/conversations/<conversation>`. O Nginx interno encaminha `/api`, `/auth` e `/cable` ao Rails; `/cable` usa WebSocket.

O serviço único `db-migrate` executa `rails db:chatwoot_prepare` antes de
iniciar Rails e Sidekiq, inclusive no primeiro deploy. As imagens `rails`, `frontend` e `bridge` são construídas pelo GitHub Actions e
publicadas no GitHub Container Registry (GHCR); a VPS somente baixa imagens
prontas. Caso os pacotes GHCR permaneçam privados, faça login uma vez na VPS
com um Personal Access Token que tenha `read:packages`:

```bash
echo 'SEU_TOKEN_GITHUB' | docker login ghcr.io -u BrunoMonteirDev --password-stdin
```

## 3. WAHA

Abra `https://$APP_DOMAIN`, faça login e acesse Configurações → Caixas de entrada. Crie/seleciona uma inbox, escolha **Conectar WAHA**, crie uma sessão, mostre o QR e escaneie pelo WhatsApp. Espere o estado `WORKING`, então clique **Associar sessão a esta inbox**.

WAHA fica somente na rede Docker; não publique sua porta em produção. O bridge é o único serviço que usa `WAHA_API_KEY`.

### Histórico manual

Depois que a sessão estiver `WORKING`, abra a aba **WhatsApp** da inbox e use
**Histórico do WhatsApp** para importar 7, 30, 90 dias ou tudo o que o GOWS já
sincronizou. A ação é manual: ela não reinicia a sessão, não pede QR de novo e
não envia mensagens. Para números antigos, ajuste com cuidado as variáveis
`WAHA_GOWS_DEVICE_HISTORY_SYNC_*` antes de parear/reparear a sessão; elas
controlam WhatsApp → GOWS e não a importação para o Chatwoot.

## 4. Webhooks

* Meta: `https://$BRIDGE_DOMAIN/webhooks/meta`
* WAHA: configurado automaticamente na criação da sessão para `https://$BRIDGE_DOMAIN/webhooks/waha`
* Evolution legado: `https://$BRIDGE_DOMAIN/webhooks/evolution`

Meta exige a assinatura configurada em produção. WAHA usa HMAC SHA-512. Não publique suas chaves em logs ou no navegador.

## 5. Backup

Dados persistentes: volumes `postgres_data`, `redis_data`, `chatwoot_storage`, `waha_sessions` e `bridge_data`. O backup prioritário é PostgreSQL:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml exec -T postgres pg_dump -U "$POSTGRES_USERNAME" "$POSTGRES_DATABASE" > chatwoot-$(date +%F).sql
```

Copie também os volumes de storage/sessões para armazenamento seguro. Nunca copie `.env.production` para repositórios públicos.

## Checklist de aceitação

1. Login e deep route após atualizar a página.
2. `/health` e `/ready` do bridge retornam sucesso.
3. WAHA: criar sessão, QR, `WORKING`, associar inbox.
4. Texto, imagem, áudio, vídeo, documento, reply, reação, edição e revoke.
5. Grupo: mensagem, participante, reply e reação.
6. Meta: inbound/outbound, status, reaction e template já aprovado.
7. Híbrido: mensagem privada pela política da inbox; operação existente pelo transport original; grupo por WAHA.
