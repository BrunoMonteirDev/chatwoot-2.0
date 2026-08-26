import React, { useState } from 'react';
import { X, Trash2, Plus, SlidersHorizontal, ArrowUpDown, Check } from 'lucide-react';
import {
  ChatStatusFilter,
  ChatSortOption,
  ChatFilterRule,
  ChatFilterField,
  ChatFilterOperator,
} from '../types';

// Agent list for dropdowns
const AVAILABLE_AGENTS = [
  'SUELI CARDOSO DA SILVA RESENDE',
  'MIGUEL GUTIERREZ SEGATELI',
  'TÁFFINI PADILHA SATURNINO',
  'ROBERT ALEXANDER HIROMI',
  'David Erick Peres Barbosa',
  'Bruno Monteiro',
  'Déborah Silveira',
  'Allan Gabriel Moreira da Silva',
  'Gustavo Kumagai',
  'Não Atribuído',
];

const AVAILABLE_INBOXES = [
  'UniFatecie API Oficial',
  'UniALFA API Oficial Geral',
  'WhatsApp Business',
  'Kopla Sistemas',
  'grupo.kopla',
];

const AVAILABLE_TEAMS = ['Comercial', 'Suporte', 'Financeiro', 'Técnico', 'Dev'];

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  rules: ChatFilterRule[];
  onApplyRules: (rules: ChatFilterRule[]) => void;
  isDarkMode?: boolean;
}

export const ChatFilterModal: React.FC<FilterModalProps> = ({
  isOpen,
  onClose,
  rules,
  onApplyRules,
  isDarkMode = false,
}) => {
  const [localRules, setLocalRules] = useState<ChatFilterRule[]>(rules);

  if (!isOpen) return null;

  const handleAddRule = () => {
    const newRule: ChatFilterRule = {
      id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      field: 'status',
      operator: 'equals',
      value: 'abertas',
    };
    setLocalRules([...localRules, newRule]);
  };

  const handleRemoveRule = (id: string) => {
    setLocalRules(localRules.filter((r) => r.id !== id));
  };

  const handleUpdateRule = (
    id: string,
    updates: Partial<ChatFilterRule>
  ) => {
    setLocalRules(
      localRules.map((r) => {
        if (r.id === id) {
          const updated = { ...r, ...updates };
          // Set default default value if field changed
          if (updates.field && updates.field !== r.field) {
            if (updates.field === 'status') updated.value = 'abertas';
            else if (updates.field === 'priority') updated.value = 'alta';
            else if (updates.field === 'assignedAgent') updated.value = AVAILABLE_AGENTS[0];
            else if (updates.field === 'inbox') updated.value = AVAILABLE_INBOXES[0];
            else if (updates.field === 'team') updated.value = AVAILABLE_TEAMS[0];
            else updated.value = '';
          }
          return updated;
        }
        return r;
      })
    );
  };

  const handleClear = () => {
    setLocalRules([]);
    onApplyRules([]);
    onClose();
  };

  const handleApply = () => {
    onApplyRules(localRules);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div
        className={`w-full max-w-xl rounded-2xl shadow-2xl border overflow-hidden flex flex-col max-h-[85vh] ${
          isDarkMode
            ? 'bg-[#1f2c34] border-[#2a3942] text-[#e9edef]'
            : 'bg-white border-gray-200 text-[#111b21]'
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 flex items-center justify-between border-b ${
            isDarkMode ? 'border-[#2a3942] bg-[#111b21]' : 'border-gray-100 bg-gray-50'
          }`}
        >
          <div className="flex items-center space-x-2">
            <SlidersHorizontal className="w-5 h-5 text-[#2563eb]" />
            <h2 className="text-base font-bold tracking-tight">Filtrar conversas</h2>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDarkMode
                ? 'hover:bg-[#202c33] text-[#8696a0] hover:text-white'
                : 'hover:bg-gray-200 text-[#54656f] hover:text-[#111b21]'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Rules List */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {localRules.length === 0 ? (
            <div className="text-center py-8 text-xs text-[#8696a0] space-y-2">
              <SlidersHorizontal className="w-8 h-8 mx-auto opacity-40 mb-2" />
              <p className="font-semibold text-sm">Nenhum filtro aplicado</p>
              <p>Clique em "+ Adicionar filtro" para criar uma regra de combinação.</p>
            </div>
          ) : (
            localRules.map((rule, idx) => (
              <div
                key={rule.id}
                className={`p-3 rounded-xl border flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-2 transition-all ${
                  isDarkMode
                    ? 'bg-[#111b21] border-[#2a3942]'
                    : 'bg-gray-50/80 border-gray-200'
                }`}
              >
                {/* Field */}
                <select
                  value={rule.field}
                  onChange={(e) =>
                    handleUpdateRule(rule.id, {
                      field: e.target.value as ChatFilterField,
                    })
                  }
                  className={`text-xs font-semibold rounded-lg px-2.5 py-2 border outline-none shrink-0 cursor-pointer ${
                    isDarkMode
                      ? 'bg-[#202c33] border-[#2a3942] text-white'
                      : 'bg-white border-gray-300 text-[#111b21]'
                  }`}
                >
                  <option value="status">Status</option>
                  <option value="priority">Prioridade</option>
                  <option value="assignedAgent">Agente atribuído</option>
                  <option value="inbox">Caixa de Entrada</option>
                  <option value="team">Nome do Time</option>
                  <option value="identifier">Identificador da conversa</option>
                  <option value="campaign">Nome da campanha</option>
                </select>

                {/* Operator */}
                <select
                  value={rule.operator}
                  onChange={(e) =>
                    handleUpdateRule(rule.id, {
                      operator: e.target.value as ChatFilterOperator,
                    })
                  }
                  className={`text-xs font-semibold rounded-lg px-2.5 py-2 border outline-none shrink-0 cursor-pointer ${
                    isDarkMode
                      ? 'bg-[#202c33] border-[#2a3942] text-white'
                      : 'bg-white border-gray-300 text-[#111b21]'
                  }`}
                >
                  <option value="equals">= Igual a</option>
                  <option value="not_equals">≠ Diferente</option>
                  <option value="present">∈ Está presente</option>
                  <option value="not_present">∉ Não está presente</option>
                </select>

                {/* Value Input/Select */}
                <div className="flex-1 min-w-0">
                  {rule.field === 'status' && (
                    <select
                      value={rule.value}
                      onChange={(e) =>
                        handleUpdateRule(rule.id, { value: e.target.value })
                      }
                      className={`w-full text-xs font-medium rounded-lg px-2.5 py-2 border outline-none cursor-pointer ${
                        isDarkMode
                          ? 'bg-[#202c33] border-[#2a3942] text-white'
                          : 'bg-white border-gray-300 text-[#111b21]'
                      }`}
                    >
                      <option value="todas">Todas</option>
                      <option value="abertas">Abertas</option>
                      <option value="abertas_pendentes">Abertas e Pendentes</option>
                      <option value="resolvidas">Resolvidas</option>
                      <option value="pendentes">Pendentes</option>
                      <option value="adiadas">Adiadas</option>
                    </select>
                  )}

                  {rule.field === 'priority' && (
                    <select
                      value={rule.value}
                      onChange={(e) =>
                        handleUpdateRule(rule.id, { value: e.target.value })
                      }
                      className={`w-full text-xs font-medium rounded-lg px-2.5 py-2 border outline-none cursor-pointer ${
                        isDarkMode
                          ? 'bg-[#202c33] border-[#2a3942] text-white'
                          : 'bg-white border-gray-300 text-[#111b21]'
                      }`}
                    >
                      <option value="todas">Todas</option>
                      <option value="alta">Alta</option>
                      <option value="media">Média</option>
                      <option value="baixa">Baixa</option>
                      <option value="urgente">Urgente</option>
                    </select>
                  )}

                  {rule.field === 'assignedAgent' && (
                    <select
                      value={rule.value}
                      onChange={(e) =>
                        handleUpdateRule(rule.id, { value: e.target.value })
                      }
                      className={`w-full text-xs font-medium rounded-lg px-2.5 py-2 border outline-none cursor-pointer ${
                        isDarkMode
                          ? 'bg-[#202c33] border-[#2a3942] text-white'
                          : 'bg-white border-gray-300 text-[#111b21]'
                      }`}
                    >
                      {AVAILABLE_AGENTS.map((agent) => (
                        <option key={agent} value={agent}>
                          {agent}
                        </option>
                      ))}
                    </select>
                  )}

                  {rule.field === 'inbox' && (
                    <select
                      value={rule.value}
                      onChange={(e) =>
                        handleUpdateRule(rule.id, { value: e.target.value })
                      }
                      className={`w-full text-xs font-medium rounded-lg px-2.5 py-2 border outline-none cursor-pointer ${
                        isDarkMode
                          ? 'bg-[#202c33] border-[#2a3942] text-white'
                          : 'bg-white border-gray-300 text-[#111b21]'
                      }`}
                    >
                      {AVAILABLE_INBOXES.map((inbox) => (
                        <option key={inbox} value={inbox}>
                          {inbox}
                        </option>
                      ))}
                    </select>
                  )}

                  {rule.field === 'team' && (
                    <select
                      value={rule.value}
                      onChange={(e) =>
                        handleUpdateRule(rule.id, { value: e.target.value })
                      }
                      className={`w-full text-xs font-medium rounded-lg px-2.5 py-2 border outline-none cursor-pointer ${
                        isDarkMode
                          ? 'bg-[#202c33] border-[#2a3942] text-white'
                          : 'bg-white border-gray-300 text-[#111b21]'
                      }`}
                    >
                      {AVAILABLE_TEAMS.map((team) => (
                        <option key={team} value={team}>
                          {team}
                        </option>
                      ))}
                    </select>
                  )}

                  {(rule.field === 'identifier' || rule.field === 'campaign') && (
                    <input
                      type="text"
                      value={rule.value}
                      onChange={(e) =>
                        handleUpdateRule(rule.id, { value: e.target.value })
                      }
                      placeholder={`Digite o ${
                        rule.field === 'identifier' ? 'identificador' : 'nome da campanha'
                      }...`}
                      className={`w-full text-xs font-medium rounded-lg px-2.5 py-2 border outline-none ${
                        isDarkMode
                          ? 'bg-[#202c33] border-[#2a3942] text-white placeholder-[#8696a0]'
                          : 'bg-white border-gray-300 text-[#111b21] placeholder-gray-400'
                      }`}
                    />
                  )}
                </div>

                {/* Remove Trash Button */}
                <button
                  onClick={() => handleRemoveRule(rule.id)}
                  title="Remover filtro"
                  className="p-2 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors shrink-0 self-end md:self-auto cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}

          {/* Add Filter Row Button */}
          <button
            onClick={handleAddRule}
            className="flex items-center space-x-1.5 text-xs font-bold text-[#2563eb] hover:text-[#1d4ed8] transition-colors py-1 px-1 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar filtro</span>
          </button>
        </div>

        {/* Footer Actions */}
        <div
          className={`px-5 py-3.5 flex items-center justify-between border-t ${
            isDarkMode ? 'border-[#2a3942] bg-[#111b21]' : 'border-gray-100 bg-gray-50'
          }`}
        >
          <button
            onClick={handleClear}
            className={`text-xs font-semibold px-3 py-2 rounded-xl transition-colors cursor-pointer ${
              isDarkMode
                ? 'text-[#8696a0] hover:text-white hover:bg-[#202c33]'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
            }`}
          >
            Limpar filtros
          </button>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className={`text-xs font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer ${
                isDarkMode
                  ? 'bg-[#202c33] text-white hover:bg-[#2a3942]'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              Cancelar
            </button>
            <button
              onClick={handleApply}
              className="text-xs font-bold px-5 py-2 rounded-xl bg-[#2563eb] text-white hover:bg-[#1d4ed8] transition-all shadow-md active:scale-95 cursor-pointer flex items-center space-x-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Aplicar filtros</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface SortPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  status: ChatStatusFilter;
  onStatusChange: (status: ChatStatusFilter) => void;
  sort: ChatSortOption;
  onSortChange: (sort: ChatSortOption) => void;
  isDarkMode?: boolean;
}

export const ChatSortPopover: React.FC<SortPopoverProps> = ({
  isOpen,
  onClose,
  status,
  onStatusChange,
  sort,
  onSortChange,
  isDarkMode = false,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className={`fixed left-3 right-3 top-16 z-50 rounded-2xl border p-4 shadow-2xl animate-fade-in md:absolute md:left-auto md:right-0 md:top-full md:mt-2 md:w-80 ${
        isDarkMode
          ? 'bg-[#1f2c34] border-[#2a3942] text-white'
          : 'bg-white border-gray-200 text-[#111b21]'
      }`}
    >
      <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-[#2a3942] mb-3">
        <div className="flex items-center space-x-2">
          <ArrowUpDown className="w-4 h-4 text-[#00a884]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#8696a0]">
            Filtros rápidos & Ordenação
          </h3>
        </div>
        <button
          onClick={onClose}
          className="text-[#8696a0] hover:text-white p-1 rounded-full cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Status Select */}
        <div>
          <label className="block text-xs font-bold mb-1.5 text-[#8696a0]">Status</label>
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value as ChatStatusFilter)}
            className={`w-full text-xs font-semibold rounded-xl p-2.5 border outline-none cursor-pointer ${
              isDarkMode
                ? 'bg-[#111b21] border-[#2a3942] text-white focus:border-[#00a884]'
                : 'bg-gray-50 border-gray-300 text-[#111b21] focus:border-[#00a884]'
            }`}
          >
            <option value="todas">Todas</option>
            <option value="abertas">Abertas</option>
            <option value="abertas_pendentes">Abertas e Pendentes</option>
            <option value="resolvidas">Resolvidas</option>
            <option value="pendentes">Pendentes</option>
            <option value="adiadas">Adiadas</option>
          </select>
        </div>

        {/* Sort Select */}
        <div>
          <label className="block text-xs font-bold mb-1.5 text-[#8696a0]">
            Ordenar por
          </label>
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as ChatSortOption)}
            className={`w-full text-xs font-semibold rounded-xl p-2.5 border outline-none cursor-pointer ${
              isDarkMode
                ? 'bg-[#111b21] border-[#2a3942] text-white focus:border-[#00a884]'
                : 'bg-gray-50 border-gray-300 text-[#111b21] focus:border-[#00a884]'
            }`}
          >
            <option value="last_activity_desc">
              Última atividade: Recentes primeiro
            </option>
            <option value="last_activity_asc">
              Última atividade: Mais antigas primeiro
            </option>
            <option value="created_at_desc">Criado em: Recentes primeiro</option>
            <option value="created_at_asc">Criado em: Antigos primeiro</option>
            <option value="priority_desc">Prioridade: Altas primeiro</option>
            <option value="priority_asc">Prioridade: Baixas primeiro</option>
            <option value="priority_and_created">
              Prioridade: Maior primeiro, Criado em mais recente
            </option>
            <option value="pending_long_first">
              Resposta pendente: Longas primeiro
            </option>
            <option value="pending_short_first">
              Resposta pendente: Curtas primeiro
            </option>
          </select>
        </div>
      </div>
    </div>
  );
};
