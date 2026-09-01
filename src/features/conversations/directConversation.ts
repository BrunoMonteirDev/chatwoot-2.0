import type { ConversationSummary } from '../../domain/currentUser';

// A directly opened conversation must remain available even when it is absent
// from the current inbox/team/label-filtered list.
export const conversationForActiveRoute = (
  listedConversations: ConversationSummary[],
  directlyLoadedConversation: ConversationSummary | null,
  activeConversationId: string,
): ConversationSummary | null => (
  listedConversations.find((conversation) => String(conversation.id) === activeConversationId)
  || (directlyLoadedConversation && String(directlyLoadedConversation.id) === activeConversationId ? directlyLoadedConversation : null)
);
