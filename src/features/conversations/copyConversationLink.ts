import { absoluteConversationUrl } from '../../routing/appRoute';

export const copyConversationLink = async ({
  origin,
  accountId,
  conversationId,
  clipboard,
  onCopied,
}: {
  origin: string;
  accountId: number;
  conversationId: number;
  clipboard: Pick<Clipboard, 'writeText'>;
  onCopied?: () => void;
}): Promise<string> => {
  const url = absoluteConversationUrl(origin, accountId, conversationId);
  await clipboard.writeText(url);
  onCopied?.();
  return url;
};
