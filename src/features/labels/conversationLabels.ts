import type { ConversationSummary } from '../../domain/currentUser';

export const uniqueLabels = (labels: string[]) => [...new Set(labels)];

export const updateConversationLabelsOptimistically = async (
  previous: string[],
  requested: string[],
  apply: (labels: string[]) => void,
  request: (labels: string[]) => Promise<Pick<ConversationSummary, 'labels'> | null>,
) => {
  const next = uniqueLabels(requested);
  apply(next);
  try {
    const result = await request(next);
    if (result) apply(uniqueLabels(result.labels));
    return result;
  } catch (error) {
    apply(previous);
    throw error;
  }
};
