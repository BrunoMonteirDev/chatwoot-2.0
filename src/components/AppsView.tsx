import React from 'react';
import { Folder, X, ExternalLink, Globe, LayoutGrid, ShieldCheck, ArrowLeft } from 'lucide-react';

interface Props {
  onClose: () => void;
  isDarkMode?: boolean;
}

export const AppsView: React.FC<Props> = ({ onClose, isDarkMode = true }) => {
  return (
    <div
      className={`flex-1 flex flex-col md:flex-row h-full min-w-0 z-20 transition-colors ${
        isDarkMode ? 'bg-[#151717] text-white' : 'bg-white text-[#111b21]'
      }`}
    >
      {/* Left Column / Apps List Header Panel */}
      <div
        className={`w-full md:w-[380px] border-r flex flex-col h-full flex-shrink-0 ${
          isDarkMode ? 'bg-[#151717] border-[#1e1f1f]' : 'bg-white border-[#d1d7db]'
        }`}
      >
        {/* Header */}
        <div
          className={`h-16 px-4 flex items-center justify-between border-b ${
            isDarkMode ? 'bg-[#1e1f1f] border-[#242525]' : 'bg-[#f0f2f5] border-[#d1d7db]'
          }`}
        >
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              title="Voltar para conversas"
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                isDarkMode ? 'hover:bg-[#242525] text-[#aebac1]' : 'hover:bg-[#e9edef] text-[#54656f]'
              }`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2">
              <Folder className="w-5 h-5 text-[#00a884]" />
              <h2 className="text-base font-bold">Apps Integrados</h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              isDarkMode ? 'hover:bg-[#242525] text-[#aebac1]' : 'hover:bg-[#e9edef] text-[#54656f]'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Apps List / Empty State in Sidebar */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center text-center space-y-4">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              isDarkMode ? 'bg-[#1e1f1f] text-[#00a884]' : 'bg-[#f0f2f5] text-[#00a884]'
            }`}
          >
            <Folder className="w-8 h-8" />
          </div>

          <div className="space-y-1.5 px-2">
            <h3 className="font-bold text-sm">Nenhum app integrado</h3>
            <p
              className={`text-xs leading-relaxed ${
                isDarkMode ? 'text-[#8696a0]' : 'text-[#667781]'
              }`}
            >
              Esta conta não possui aplicativos embutidos configurados no momento.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer"
          >
            Voltar para Conversas
          </button>
        </div>
      </div>

      {/* Right Column / Embedded Apps Detail Pane */}
      <div
        className={`hidden md:flex flex-1 h-full flex-col items-center justify-center p-8 text-center overflow-y-auto ${
          isDarkMode ? 'bg-[#0e0c0c]' : 'bg-[#f0f2f5]'
        }`}
      >
        <div className="max-w-md space-y-6 flex flex-col items-center">
          {/* Main Illustration Badge */}
          <div className="relative">
            <div className="w-24 h-24 rounded-3xl bg-[#00a884]/10 border border-[#00a884]/20 flex items-center justify-center text-[#00a884] shadow-lg">
              <LayoutGrid className="w-12 h-12" />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-[#00a884] text-white p-2 rounded-xl shadow-md">
              <Globe className="w-4 h-4" />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold">Nenhum aplicativo integrado</h3>
            <p
              className={`text-xs sm:text-sm leading-relaxed max-w-sm mx-auto ${
                isDarkMode ? 'text-[#8696a0]' : 'text-[#667781]'
              }`}
            >
              A aba de Apps é exclusivamente destinada à exibição de sites e sistemas web incorporados (como CRM, MetaHub e dashboards).
            </p>
          </div>

          {/* Feature highlights card */}
          <div
            className={`w-full p-4 rounded-2xl border text-left space-y-3 ${
              isDarkMode
                ? 'bg-[#151717] border-[#1e1f1f]'
                : 'bg-white border-[#d1d7db]'
            }`}
          >
            <div className="flex items-start space-x-3">
              <Globe className="w-5 h-5 text-[#00a884] shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold">Sistemas & Websites Embeddados</h4>
                <p
                  className={`text-[11px] ${
                    isDarkMode ? 'text-[#8696a0]' : 'text-[#667781]'
                  }`}
                >
                  Acesso direto a iFrames integrados sem precisar sair do painel do atendimento.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 border-t pt-3 border-white/5">
              <ShieldCheck className="w-5 h-5 text-[#00a884] shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold">Isolamento Multitenant</h4>
                <p
                  className={`text-[11px] ${
                    isDarkMode ? 'text-[#8696a0]' : 'text-[#667781]'
                  }`}
                >
                  Cada conta cliente possui seus próprios aplicativos configurados de forma segura.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para Conversas</span>
          </button>
        </div>
      </div>
    </div>
  );
};
