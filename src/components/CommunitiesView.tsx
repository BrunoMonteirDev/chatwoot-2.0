import React from 'react';
import { ContactsView } from './ContactsView';
import { Chat, Attachment } from '../types';

interface Props {
  chats?: Chat[];
  onSelectChat?: (chat: Chat) => void;
  onCreateNewChat?: (
    name: string,
    phone: string,
    channelName: string,
    initialMessageText?: string,
    isPrivate?: boolean,
    attachments?: Attachment[]
  ) => void;
  onUpdateContact?: (chatId: string, updates: Partial<Chat>) => void;
  onDeleteContact?: (chatId: string) => void;
  onClose: () => void;
  isDarkMode?: boolean;
}

export const CommunitiesView: React.FC<Props> = ({
  chats = [],
  onSelectChat = () => {},
  onCreateNewChat = () => {},
  onUpdateContact = () => {},
  onDeleteContact = () => {},
  onClose,
  isDarkMode = false,
}) => {
  return (
    <div className="flex-1 h-full overflow-hidden flex flex-col z-20">
      <ContactsView
        chats={chats}
        onSelectChat={onSelectChat}
        onCreateNewChat={onCreateNewChat}
        onUpdateContact={onUpdateContact}
        onDeleteContact={onDeleteContact}
        onClose={onClose}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};

export { ContactsView };
