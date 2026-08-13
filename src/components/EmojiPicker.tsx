import React from 'react';

interface Props {
  onSelectEmoji: (emoji: string) => void;
  onClose: () => void;
}

const EMOJI_CATEGORIES = [
  {
    name: 'Frequentes',
    emojis: ['👍', '❤️', '😂', '🔥', '🙏', '😊', '🎉', '🚀', '🔑', '💻', '✔️', '✅', '👌', '👏', '🙌', '👀']
  },
  {
    name: 'Rostos e Pessoas',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑']
  },
  {
    name: 'Objetos e Símbolos',
    emojis: ['📌', '🔕', '💬', '📞', '📷', '📁', '📊', '📈', '📋', '⚙️', '🔒', '🔑', '💡', '📢', '🎯', '✨', '⚡', '🔥', '🌟', '💥', '🟢', '🔵', '🔴', '⭐']
  }
];

export const EmojiPicker: React.FC<Props> = ({ onSelectEmoji, onClose }) => {
  return (
    <div className="absolute bottom-16 left-2 sm:left-4 max-w-[calc(100vw-1rem)] w-72 sm:w-80 bg-white border border-[#d1d7db] rounded-xl shadow-xl p-3 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
      <div className="flex items-center justify-between pb-2 border-b border-[#f0f2f5] text-xs text-[#667781]">
        <span className="font-semibold text-[#111b21]">Emojis</span>
        <button
          onClick={onClose}
          className="hover:text-[#111b21] px-1 py-0.5 rounded transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="max-h-60 overflow-y-auto mt-2 space-y-3 no-scrollbar">
        {EMOJI_CATEGORIES.map((cat) => (
          <div key={cat.name}>
            <div className="text-[11px] font-medium text-[#667781] mb-1">{cat.name}</div>
            <div className="grid grid-cols-8 gap-1">
              {cat.emojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => onSelectEmoji(emoji)}
                  className="w-8 h-8 flex items-center justify-center text-lg hover:bg-[#f0f2f5] rounded transition-transform hover:scale-110"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
