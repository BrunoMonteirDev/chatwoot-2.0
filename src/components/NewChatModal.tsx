import React from 'react';
import { NewChatPanel } from './NewChatPanel';
import { Chat, Attachment } from '../types';

interface Props {
  chats: Chat[];
  onSelectChat: (chat: Chat) => void;
  onCreateNewChat: (
    name: string,
    phone: string,
    channelName: string,
    initialMessageText?: string,
    isPrivate?: boolean,
    attachments?: Attachment[]
  ) => void;
  onClose: () => void;
  isDarkMode?: boolean;
}

export const NewChatModal: React.FC<Props> = (props) => {
  return <NewChatPanel {...props} />;
};
