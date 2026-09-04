import type { OperationalWhatsAppConnection, WhatsAppSendCapability } from '../../integrations/whatsapp/connection';

export type ComposerNotice = { title: string; description: string; action: 'manager' | 'template' };

export const composerNotice = (
  capability: WhatsAppSendCapability | null | undefined,
  legacy: OperationalWhatsAppConnection | null | undefined,
  isPrivate: boolean
): ComposerNotice | null => {
  if (isPrivate) return null;
  const reason = capability?.send_block_reason;
  if (capability?.applicable && !capability.can_send_freeform) {
    if (reason === 'outside_window_template') return { title: 'Esta conversa está fora da janela de 24 horas.', description: 'Para continuar, envie um template aprovado.', action: 'template' };
    if (reason === 'reauthorization_required') return { title: 'WhatsApp oficial desconectado', description: 'A conexão com a Meta precisa ser reautorizada.', action: 'manager' };
    if (reason === 'meta_disconnected') return { title: 'WhatsApp oficial desconectado', description: 'Reconecte a conta Meta para voltar a enviar mensagens.', action: 'manager' };
    if (reason === 'waha_missing') return { title: 'WhatsApp desconectado', description: 'Configure uma sessão WAHA para voltar a enviar mensagens.', action: 'manager' };
    return { title: reason === 'waha_disconnected' ? 'WhatsApp desconectado' : 'Envio por WhatsApp indisponível', description: reason === 'waha_disconnected' ? 'O envio por WAHA está indisponível porque a sessão está desconectada.' : 'Reconecte a sessão para voltar a enviar mensagens.', action: 'manager' };
  }
  if (legacy?.applicable && !legacy.sendAllowed) return { title: 'WhatsApp desconectado', description: 'Reconecte a sessão para voltar a enviar mensagens.', action: 'manager' };
  return null;
};
