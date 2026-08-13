import React from 'react';
import { Minus, Square, X } from 'lucide-react';

export const WindowHeader: React.FC = () => {
  return (
    <div className="h-9 bg-[#f0f2f5] text-[#54656f] flex items-center justify-between px-3 select-none text-xs border-b border-[#d1d7db] z-50">
      <div className="flex items-center space-x-2 text-[#54656f]">
        <div className="w-2.5 h-2.5 rounded-full bg-[#00a884]" />
        <span className="font-semibold text-[#111b21]">WhatsApp Business</span>
      </div>

      <div className="flex items-center space-x-1">
        <button
          title="Minimizar"
          className="w-7 h-7 flex items-center justify-center hover:bg-[#e9edef] rounded text-[#54656f] transition-colors"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          title="Maximizar"
          className="w-7 h-7 flex items-center justify-center hover:bg-[#e9edef] rounded text-[#54656f] transition-colors"
        >
          <Square className="w-3 h-3" />
        </button>
        <button
          title="Fechar"
          className="w-7 h-7 flex items-center justify-center hover:bg-[#e81123] hover:text-white rounded text-[#54656f] transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
