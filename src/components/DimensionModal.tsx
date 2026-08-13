import React from 'react';
import { Sliders, Maximize2, RotateCcw, X, Check, Eye } from 'lucide-react';

interface DimensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  uiWidthScale: number;
  uiHeightScale: number;
  uiFontScale: number;
  onChangeDimensions: (width: number, height: number, font: number) => void;
  isDarkMode: boolean;
}

export const DimensionModal: React.FC<DimensionModalProps> = ({
  isOpen,
  onClose,
  uiWidthScale,
  uiHeightScale,
  uiFontScale,
  onChangeDimensions,
  isDarkMode,
}) => {
  if (!isOpen) return null;

  const handleReset = () => {
    onChangeDimensions(100, 100, 100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 ${
          isDarkMode ? 'bg-[#1e1f1f] border-[#2a3238] text-white' : 'bg-white border-[#d1d7db] text-[#111b21]'
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 flex items-center justify-between border-b ${
            isDarkMode ? 'border-[#2a3238] bg-[#242525]' : 'border-[#d1d7db] bg-[#f0f2f5]'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#00a884]/20 text-[#00a884] flex items-center justify-center">
              <Maximize2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Ajustar Dimensões do Sistema</h3>
              <p className="text-[11px] text-[#8696a0]">Personalize a largura, altura e densidade visual de toda a aplicação</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDarkMode ? 'hover:bg-[#2a3942] text-[#aebac1]' : 'hover:bg-[#e9edef] text-[#54656f]'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 text-xs overflow-y-auto max-h-[75vh]">
          {/* 1. Largura do Sistema */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-xs flex items-center space-x-2">
                <span>Largura do Sistema</span>
              </label>
              <span className="font-mono text-xs text-[#00a884] font-bold bg-[#00a884]/10 px-2 py-0.5 rounded-md">
                {uiWidthScale}%
              </span>
            </div>
            <input
              type="range"
              min="80"
              max="130"
              step="1"
              value={uiWidthScale}
              onChange={(e) => onChangeDimensions(parseInt(e.target.value, 10), uiHeightScale, uiFontScale)}
              className="w-full accent-[#00a884] cursor-pointer"
            />
            {/* Quick Presets */}
            <div className="grid grid-cols-4 gap-2 pt-1">
              {[
                { label: 'Compacta', val: 85 },
                { label: 'Padrão', val: 100 },
                { label: 'Ampla', val: 110 },
                { label: 'Máxima', val: 120 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => onChangeDimensions(preset.val, uiHeightScale, uiFontScale)}
                  className={`py-1.5 px-2 rounded-lg border font-semibold text-[11px] transition-colors cursor-pointer ${
                    uiWidthScale === preset.val
                      ? 'bg-[#00a884] border-[#00a884] text-white'
                      : isDarkMode
                      ? 'bg-[#242525] border-[#2a3238] text-[#aebac1] hover:text-white'
                      : 'bg-[#f0f2f5] border-[#d1d7db] text-[#54656f] hover:text-[#111b21]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Altura e Densidade Vertical */}
          <div className="space-y-2.5 pt-2 border-t border-white/5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-xs flex items-center space-x-2">
                <span>Altura / Densidade Vertical</span>
              </label>
              <span className="font-mono text-xs text-[#00a884] font-bold bg-[#00a884]/10 px-2 py-0.5 rounded-md">
                {uiHeightScale}%
              </span>
            </div>
            <input
              type="range"
              min="80"
              max="130"
              step="1"
              value={uiHeightScale}
              onChange={(e) => onChangeDimensions(uiWidthScale, parseInt(e.target.value, 10), uiFontScale)}
              className="w-full accent-[#00a884] cursor-pointer"
            />
            {/* Quick Presets */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {[
                { label: 'Ultra Compacta', val: 85 },
                { label: 'Padrão', val: 100 },
                { label: 'Espaçosa', val: 115 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => onChangeDimensions(uiWidthScale, preset.val, uiFontScale)}
                  className={`py-1.5 px-2 rounded-lg border font-semibold text-[11px] transition-colors cursor-pointer ${
                    uiHeightScale === preset.val
                      ? 'bg-[#00a884] border-[#00a884] text-white'
                      : isDarkMode
                      ? 'bg-[#242525] border-[#2a3238] text-[#aebac1] hover:text-white'
                      : 'bg-[#f0f2f5] border-[#d1d7db] text-[#54656f] hover:text-[#111b21]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Escala Geral de Fontes e Elementos */}
          <div className="space-y-2.5 pt-2 border-t border-white/5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-xs flex items-center space-x-2">
                <span>Escala de Fontes & Elementos</span>
              </label>
              <span className="font-mono text-xs text-[#00a884] font-bold bg-[#00a884]/10 px-2 py-0.5 rounded-md">
                {uiFontScale}%
              </span>
            </div>
            <input
              type="range"
              min="85"
              max="120"
              step="1"
              value={uiFontScale}
              onChange={(e) => onChangeDimensions(uiWidthScale, uiHeightScale, parseInt(e.target.value, 10))}
              className="w-full accent-[#00a884] cursor-pointer"
            />
          </div>

          {/* Live Preview Box */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between ${
              isDarkMode ? 'bg-[#151717] border-[#2a3238]' : 'bg-[#f0f2f5] border-[#d1d7db]'
            }`}
          >
            <div className="flex items-center space-x-2.5 text-[#8696a0]">
              <Eye className="w-4 h-4 text-[#00a884]" />
              <span className="font-medium text-[11px]">
                Escala Ativa: <strong className="text-white font-mono">{uiWidthScale}% L</strong> &times;{' '}
                <strong className="text-white font-mono">{uiHeightScale}% A</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center space-x-1 text-[#00a884] hover:underline font-bold text-[11px] cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Restaurar 100%</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div
          className={`px-5 py-3 flex items-center justify-end border-t ${
            isDarkMode ? 'border-[#2a3238] bg-[#242525]' : 'border-[#d1d7db] bg-[#f0f2f5]'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-[#00a884] hover:bg-[#008069] text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center space-x-1.5 shadow-md"
          >
            <Check className="w-4 h-4" />
            <span>Aplicar e Concluir</span>
          </button>
        </div>
      </div>
    </div>
  );
};
