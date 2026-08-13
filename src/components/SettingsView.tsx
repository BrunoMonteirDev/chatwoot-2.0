import React, { useState } from 'react';
import {
  X,
  User,
  Building,
  Users,
  UserCheck,
  Inbox,
  Tag,
  Code,
  Repeat,
  Sliders,
  MessageSquareQuote,
  Clock,
  LayoutGrid,
  Plug,
  Scroll,
  ShieldCheck,
  Plus,
  Trash2,
  Edit3,
  Check,
  Search,
  Sun,
  Moon,
  Palette,
  CheckCircle2,
  VolumeX,
  Bell,
  Lock,
  HelpCircle,
  ChevronRight,
  Info,
  CheckSquare,
  Square,
  AlertCircle,
  ExternalLink,
  Key,
  Globe,
  Settings,
  Mail,
  Send,
  Zap,
  Filter,
  Bot,
  Timer,
  GitFork,
  BarChart2,
} from 'lucide-react';
import { UserProfile } from '../types';
import type { Inbox as ChatwootInbox } from '../domain/currentUser';
import {
  WALLPAPER_PRESETS,
  WallpaperId,
} from './WhatsAppDoodleBg';
import { EvolutionInboxesPanel } from './EvolutionInboxesPanel';

export type SettingsTab =
  | 'conta'
  | 'agentes'
  | 'times'
  | 'caixas'
  | 'etiquetas'
  | 'atributos'
  | 'kanban'
  | 'kanbancrm'
  | 'automacao'
  | 'n8n'
  | 'bots'
  | 'macros'
  | 'respostas'
  | 'agendadas'
  | 'aplicacoes'
  | 'integracoes'
  | 'auditoria'
  | 'permissoes';

interface Props {
  user: UserProfile;
  onUpdateUser: (updated: UserProfile) => void;
  onClose: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  wallpaperId: WallpaperId;
  onSelectWallpaper: (id: WallpaperId) => void;
  activeTab?: SettingsTab;
  onTabChange?: (tab: SettingsTab) => void;
  uiWidthScale?: number;
  uiHeightScale?: number;
  uiFontScale?: number;
  onChangeDimensions?: (w: number, h: number, f: number) => void;
  accountId?: number | null;
  inboxes?: ChatwootInbox[];
  inboxesStatus?: 'idle' | 'loading' | 'ready' | 'error';
  inboxesError?: string | null;
  onRefreshInboxes?: () => Promise<void> | void;
}

export const SettingsView: React.FC<Props> = ({
  user,
  onUpdateUser,
  onClose,
  isDarkMode,
  onToggleDarkMode,
  wallpaperId,
  onSelectWallpaper,
  uiWidthScale = 100,
  uiHeightScale = 100,
  uiFontScale = 100,
  onChangeDimensions,
  activeTab: propActiveTab,
  onTabChange: propOnTabChange,
  accountId = null,
  inboxes: chatwootInboxes = [],
  inboxesStatus = 'idle',
  inboxesError = null,
  onRefreshInboxes = () => undefined,
}: Props) => {
  const [internalTab, setInternalTab] = useState<SettingsTab>('conta');
  const activeTab = propActiveTab || internalTab;

  const handleTabSelect = (tab: SettingsTab) => {
    setInternalTab(tab);
    propOnTabChange?.(tab);
  };

  // General Toast Notice State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // --- STATE FOR CONTA ---
  const [accountName, setAccountName] = useState('ChatBotcom');
  const [supportEmail, setSupportEmail] = useState('atendimento@chatbotcom.com.br');
  const [timezone, setTimezone] = useState('America/Sao_Paulo');

  // --- STATE FOR AGENTES ---
  const [agents, setAgents] = useState([
    { id: '1', name: 'Bruno Medeiros', email: 'bruno.alves@kopla.com.br', role: 'Administrador', status: 'Online', capacity: 10 },
    { id: '2', name: 'Maria Silva', email: 'maria.silva@kopla.com.br', role: 'Atendente', status: 'Online', capacity: 5 },
    { id: '3', name: 'Carlos Santos', email: 'carlos.santos@kopla.com.br', role: 'Supervisor', status: 'Ocupado', capacity: 8 },
    { id: '4', name: 'Ana Oliveira', email: 'ana.oliveira@kopla.com.br', role: 'Atendente', status: 'Offline', capacity: 5 },
  ]);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentEmail, setNewAgentEmail] = useState('');
  const [newAgentRole, setNewAgentRole] = useState('Atendente');

  const handleAddAgent = () => {
    if (!newAgentName || !newAgentEmail) return;
    setAgents([
      ...agents,
      {
        id: String(Date.now()),
        name: newAgentName,
        email: newAgentEmail,
        role: newAgentRole,
        status: 'Online',
        capacity: 5,
      },
    ]);
    setNewAgentName('');
    setNewAgentEmail('');
    setShowAgentModal(false);
    showToast('Agente adicionado com sucesso!');
  };

  const handleDeleteAgent = (id: string) => {
    setAgents(agents.filter((a) => a.id !== id));
    showToast('Agente removido.');
  };

  // --- STATE FOR TIMES ---
  const [teams, setTeams] = useState([
    { id: '1', name: 'Suporte Técnico', description: 'Atendimento de dúvidas e incidentes', members: 3, autoAssign: true },
    { id: '2', name: 'Vendas & Leads', description: 'Qualificação de novos clientes e negociação', members: 2, autoAssign: true },
    { id: '3', name: 'Financeiro', description: 'Envio de 2ª via de boletos e cobranças', members: 1, autoAssign: false },
  ]);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');

  const handleAddTeam = () => {
    if (!newTeamName) return;
    setTeams([
      ...teams,
      {
        id: String(Date.now()),
        name: newTeamName,
        description: newTeamDesc || 'Time de atendimento',
        members: 1,
        autoAssign: true,
      },
    ]);
    setNewTeamName('');
    setNewTeamDesc('');
    setShowTeamModal(false);
    showToast('Time criado com sucesso!');
  };

  // --- STATE FOR ETIQUETAS ---
  const [tags, setTags] = useState([
    { id: '1', label: 'VIP', color: '#3b82f6', count: 12 },
    { id: '2', label: 'Suporte', color: '#00a884', count: 28 },
    { id: '3', label: 'Pagamento Pendente', color: '#ef4444', count: 8 },
    { id: '4', label: 'Lead Qualificado', color: '#8b5cf6', count: 15 },
    { id: '5', label: 'Aguardando Cliente', color: '#f59e0b', count: 9 },
  ]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [newTagLabel, setNewTagLabel] = useState('');
  const [newTagColor, setNewTagColor] = useState('#00a884');

  const handleAddTag = () => {
    if (!newTagLabel) return;
    setTags([...tags, { id: String(Date.now()), label: newTagLabel, color: newTagColor, count: 0 }]);
    setNewTagLabel('');
    setShowTagModal(false);
    showToast('Etiqueta criada!');
  };

  const handleDeleteTag = (id: string) => {
    setTags(tags.filter((t) => t.id !== id));
    showToast('Etiqueta removida.');
  };

  // --- STATE FOR ATRIBUTOS ---
  const [attributes, setAttributes] = useState([
    { id: '1', name: 'CPF_CNPJ', key: 'cpf_cnpj', type: 'Texto', target: 'Contato' },
    { id: '2', name: 'DATA_NASCIMENTO', key: 'data_nascimento', type: 'Data', target: 'Contato' },
    { id: '3', name: 'PLANO_CONTRATADO', key: 'plano_contratado', type: 'Opção', target: 'Contato' },
    { id: '4', name: 'VALOR_FATURA', key: 'valor_fatura', type: 'Número', target: 'Conversa' },
  ]);
  const [showAttributeModal, setShowAttributeModal] = useState(false);
  const [newAttrKey, setNewAttrKey] = useState('');
  const [newAttrType, setNewAttrType] = useState('Texto');

  const handleAddAttribute = () => {
    if (!newAttrKey) return;
    setAttributes([
      ...attributes,
      {
        id: String(Date.now()),
        name: newAttrKey.toUpperCase().replace(/\s+/g, '_'),
        key: newAttrKey.toLowerCase().replace(/\s+/g, '_'),
        type: newAttrType,
        target: 'Contato',
      },
    ]);
    setNewAttrKey('');
    setShowAttributeModal(false);
    showToast('Atributo personalizado criado!');
  };

  // --- STATE FOR AUTOMATION ---
  const [automations, setAutomations] = useState([
    { id: '1', name: 'Atribuição automática em rodízio ao receber mensagem', active: true, trigger: 'Nova Mensagem' },
    { id: '2', name: 'Enviar mensagem de boas-vindas fora do horário comercial', active: true, trigger: 'Fora do Horário' },
    { id: '3', name: 'Encerrar conversas inativas por mais de 48 horas', active: true, trigger: 'Inatividade' },
    { id: '4', name: 'Atribuir tag "Urgente" se a mensagem contiver "CANCELAR"', active: false, trigger: 'Palavra-chave' },
  ]);

  const toggleAutomation = (id: string) => {
    setAutomations(automations.map((a) => (a.id === id ? { ...a, active: !a.active } : a)));
    showToast('Status da automação alterado.');
  };

  // --- STATE FOR MACROS ---
  const [macros, setMacros] = useState([
    { id: '1', name: 'Resolver + Pesquisa CSAT', actions: 'Aplica tag "Resolvido", envia pesquisa e encerra conversa', usage: 142 },
    { id: '2', name: 'Encaminhar para Financeiro', actions: 'Transfere para o time Financeiro e adiciona nota interna', usage: 89 },
    { id: '3', name: 'Enviar Chave PIX e Instruções', actions: 'Envia texto da chave PIX + agenda lembrete de cobrança', usage: 215 },
  ]);

  // --- STATE FOR RESPOSTAS PRONTAS ---
  const [cannedResponses, setCannedResponses] = useState([
    { id: '1', shortcut: '/boasvindas', content: 'Olá! Seja bem-vindo ao nosso atendimento. Como posso ajudar você hoje?' },
    { id: '2', shortcut: '/pix', content: 'Nossa chave PIX para pagamentos é o CNPJ: 00.000.000/0001-00 (Kopla Sistemas).' },
    { id: '3', shortcut: '/horario', content: 'Nosso horário de funcionamento é de segunda a sexta das 08h às 18h.' },
    { id: '4', shortcut: '/obrigado', content: 'Agradecemos o seu contato! Se precisar de algo mais, estamos à disposição.' },
  ]);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [newShortcut, setNewShortcut] = useState('');
  const [newContent, setNewContent] = useState('');

  const handleAddResponse = () => {
    if (!newShortcut || !newContent) return;
    const formattedShortcut = newShortcut.startsWith('/') ? newShortcut : `/${newShortcut}`;
    setCannedResponses([
      ...cannedResponses,
      { id: String(Date.now()), shortcut: formattedShortcut, content: newContent },
    ]);
    setNewShortcut('');
    setNewContent('');
    setShowResponseModal(false);
    showToast('Resposta pronta adicionada!');
  };

  const handleDeleteResponse = (id: string) => {
    setCannedResponses(cannedResponses.filter((c) => c.id !== id));
    showToast('Resposta pronta removida.');
  };

  // --- STATE FOR MENSAGENS AGENDADAS ---
  const [scheduledMessages, setScheduledMessages] = useState([
    { id: '1', recipient: 'João Silva', date: '01/08/2026 09:00', text: 'Lembrete: Seu boleto vence amanhã!', status: 'Agendado' },
    { id: '2', recipient: 'Mariana Costa', date: '02/08/2026 14:30', text: 'Olá Mariana, confirma nossa reunião de onboarding?', status: 'Agendado' },
    { id: '3', recipient: 'Grupo VIP Clientes', date: '30/07/2026 18:00', text: 'Lançamento do novo módulo de IA exclusivo.', status: 'Enviado' },
  ]);

  // --- STATE FOR APLICAÇÕES ---
  const [webhooks, setWebhooks] = useState([
    { id: '1', name: 'Webhook CRM Interno', url: 'https://api.kopla.com.br/webhooks/chats', active: true },
    { id: '2', name: 'Conector Typebot', url: 'https://typebot.io/api/v1/webhook', active: true },
    { id: '3', name: 'Integração Google Sheets Sync', url: 'https://script.google.com/macros/s/exec', active: false },
  ]);

  // --- STATE FOR PERMISSÕES ---
  const [permissions, setPermissions] = useState({
    viewOtherChats: true,
    exportContacts: true,
    deleteMessages: false,
    manageSettings: true,
    manageAgents: true,
    assignChats: true,
  });

  const togglePermission = (key: keyof typeof permissions) => {
    setPermissions({ ...permissions, [key]: !permissions[key] });
    showToast('Permissão atualizada.');
  };

  // --- STATE FOR AUDIT LOGS ---
  const auditLogs = [
    { id: '1', time: '31/07/2026 14:48', user: 'Bruno Medeiros', action: 'Alterou configurações do sistema', ip: '187.55.12.4' },
    { id: '2', time: '31/07/2026 14:10', user: 'Maria Silva', action: 'Exportou 48 contatos em CSV', ip: '177.32.90.11' },
    { id: '3', time: '31/07/2026 12:30', user: 'Carlos Santos', action: 'Adicionou agente "Ana Oliveira"', ip: '189.10.88.99' },
    { id: '4', time: '30/07/2026 18:15', user: 'Sistema', action: 'Executou automação "Boas-vindas"', ip: '127.0.0.1' },
  ];

  return (
    <div
      className={`flex-1 flex flex-col h-full z-20 transition-colors ${
        isDarkMode ? 'bg-[#111b21] text-[#e9edef]' : 'bg-white text-[#111b21]'
      }`}
    >
      {/* Toast Floating Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#00a884] text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center space-x-2 text-xs font-bold animate-fade-in">
          <Check className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Settings Top Header Bar */}
      <div
        className={`h-14 px-6 flex items-center justify-between border-b shrink-0 ${
          isDarkMode ? 'bg-[#182228] border-[#222d34]' : 'bg-[#f0f2f5] border-[#d1d7db]'
        }`}
      >
        <div className="flex items-center space-x-2.5">
          <Settings className="w-5 h-5 text-[#00a884]" />
          <h2 className="text-sm font-bold capitalize">
            Configurações &rsaquo; <span className="text-[#00a884]">{activeTab.replace('_', ' ')}</span>
          </h2>
        </div>
        <button
          onClick={onClose}
          type="button"
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
            isDarkMode ? 'hover:bg-[#2a3942] text-[#aebac1]' : 'hover:bg-[#e9edef] text-[#54656f]'
          }`}
          title="Fechar configurações"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content Area */}
      <div
        className={`flex-1 overflow-y-auto p-6 md:p-8 transition-colors ${
          isDarkMode ? 'bg-[#0b141a]' : 'bg-[#f8f9fa]'
        }`}
      >
        <div className="max-w-4xl mx-auto space-y-6">
          {/* ==================== 1. CONTA ==================== */}
          {activeTab === 'conta' && (
            <div
              className={`p-6 rounded-2xl border shadow-xl space-y-6 ${
                isDarkMode ? 'bg-[#111b21] border-[#222d34]' : 'bg-white border-[#d1d7db]'
              }`}
            >
              <div className="flex items-center justify-between border-b pb-4 border-white/10">
                <div>
                  <h3 className="text-lg font-bold">Configurações da Conta</h3>
                  <p className="text-xs text-[#8696a0]">Gerencie informações da conta, temas e dados do perfil.</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[#00a884]/10 text-[#00a884] flex items-center justify-center font-bold">
                  <Building className="w-5 h-5" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#8696a0]">Nome da Conta / Empresa</label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    className={`w-full px-3.5 py-2 rounded-xl border text-xs outline-none ${
                      isDarkMode ? 'bg-[#202c33] border-[#2a3942] text-white' : 'bg-[#f0f2f5] border-[#d1d7db]'
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#8696a0]">Email de Suporte</label>
                  <input
                    type="email"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    className={`w-full px-3.5 py-2 rounded-xl border text-xs outline-none ${
                      isDarkMode ? 'bg-[#202c33] border-[#2a3942] text-white' : 'bg-[#f0f2f5] border-[#d1d7db]'
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#8696a0]">Fuso Horário</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className={`w-full px-3.5 py-2 rounded-xl border text-xs outline-none ${
                      isDarkMode ? 'bg-[#202c33] border-[#2a3942] text-white' : 'bg-[#f0f2f5] border-[#d1d7db]'
                    }`}
                  >
                    <option value="America/Sao_Paulo">(GMT-03:00) Brasília / São Paulo</option>
                    <option value="America/Manaus">(GMT-04:00) Manaus</option>
                    <option value="Europe/Lisbon">(GMT+00:00) Lisboa</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#8696a0]">ID do Workspace</label>
                  <div
                    className={`w-full px-3.5 py-2 rounded-xl border text-xs font-mono select-all ${
                      isDarkMode ? 'bg-[#182228] border-[#2a3942] text-gray-400' : 'bg-gray-100 border-[#d1d7db] text-gray-600'
                    }`}
                  >
                    ACC-2026-3C-CHATBOTCOM
                  </div>
                </div>
              </div>

              {/* Theme & Wallpaper Toggle Section */}
              <div className="pt-4 border-t border-white/10 space-y-4">
                <h4 className="text-sm font-bold flex items-center space-x-2">
                  <Palette className="w-4 h-4 text-[#00a884]" />
                  <span>Aparência e Tema</span>
                </h4>

                {/* Dimensions Adjustment Block */}
                {onChangeDimensions && (
                  <div
                    className={`p-4 rounded-xl border mt-4 space-y-4 ${
                      isDarkMode ? 'bg-[#182228] border-[#2a3942]' : 'bg-[#f0f2f5] border-[#d1d7db]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Sliders className="w-4 h-4 text-[#00a884]" />
                        <span className="text-xs font-bold">Ajustes de Dimensões do Sistema (Largura, Altura & Escala)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onChangeDimensions(100, 100, 100)}
                        className="text-[11px] font-bold text-[#00a884] hover:underline cursor-pointer"
                      >
                        Restaurar Padrão (100%)
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                      {/* Largura */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-semibold text-[#8696a0]">
                          <span>Largura Geral</span>
                          <span className="text-[#00a884] font-bold">{uiWidthScale}%</span>
                        </div>
                        <input
                          type="range"
                          min="70"
                          max="130"
                          step="1"
                          value={uiWidthScale}
                          onChange={(e) =>
                            onChangeDimensions(parseInt(e.target.value, 10), uiHeightScale, uiFontScale)
                          }
                          className="w-full accent-[#00a884] cursor-pointer"
                        />
                      </div>

                      {/* Altura */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-semibold text-[#8696a0]">
                          <span>Altura Geral</span>
                          <span className="text-[#00a884] font-bold">{uiHeightScale}%</span>
                        </div>
                        <input
                          type="range"
                          min="70"
                          max="130"
                          step="1"
                          value={uiHeightScale}
                          onChange={(e) =>
                            onChangeDimensions(uiWidthScale, parseInt(e.target.value, 10), uiFontScale)
                          }
                          className="w-full accent-[#00a884] cursor-pointer"
                        />
                      </div>

                      {/* Escala de Texto */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-semibold text-[#8696a0]">
                          <span>Escala de Texto</span>
                          <span className="text-[#00a884] font-bold">{uiFontScale}%</span>
                        </div>
                        <input
                          type="range"
                          min="80"
                          max="120"
                          step="1"
                          value={uiFontScale}
                          onChange={(e) =>
                            onChangeDimensions(uiWidthScale, uiHeightScale, parseInt(e.target.value, 10))
                          }
                          className="w-full accent-[#00a884] cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 max-w-sm">
                  <button
                    type="button"
                    onClick={() => isDarkMode && onToggleDarkMode()}
                    className={`p-3 rounded-xl border flex items-center space-x-3 transition-all cursor-pointer ${
                      !isDarkMode
                        ? 'border-[#00a884] bg-[#00a884]/10 text-[#00a884] font-bold'
                        : 'border-[#2a3942] bg-[#202c33] text-[#8696a0]'
                    }`}
                  >
                    <Sun className="w-5 h-5 text-amber-500" />
                    <span className="text-xs">Modo Claro</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => !isDarkMode && onToggleDarkMode()}
                    className={`p-3 rounded-xl border flex items-center space-x-3 transition-all cursor-pointer ${
                      isDarkMode
                        ? 'border-[#00a884] bg-[#00a884]/10 text-[#00a884] font-bold'
                        : 'border-[#d1d7db] bg-white text-[#8696a0]'
                    }`}
                  >
                    <Moon className="w-5 h-5 text-indigo-400" />
                    <span className="text-xs">Modo Escuro</span>
                  </button>
                </div>

                {/* Wallpaper Options */}
                <div className="pt-2">
                  <label className="text-xs font-semibold text-[#8696a0] mb-2 block">Papel de Parede do Chat</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {WALLPAPER_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => onSelectWallpaper(preset.id)}
                        className={`p-2.5 rounded-xl border text-xs font-medium text-left truncate transition-all cursor-pointer ${
                          wallpaperId === preset.id
                            ? 'border-[#00a884] bg-[#00a884]/10 font-bold text-[#00a884]'
                            : isDarkMode
                            ? 'border-[#2a3942] bg-[#202c33] text-gray-300'
                            : 'border-gray-200 bg-white text-gray-700'
                        }`}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => showToast('Configurações salvas!')}
                  className="px-5 py-2.5 bg-[#00a884] hover:bg-[#008069] text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  Salvar Alterações
                </button>
              </div>
            </div>
          )}

          {/* ==================== 2. AGENTES ==================== */}
          {activeTab === 'agentes' && (
            <div
              className={`p-6 rounded-2xl border shadow-xl space-y-6 ${
                isDarkMode ? 'bg-[#111b21] border-[#222d34]' : 'bg-white border-[#d1d7db]'
              }`}
            >
              <div className="flex items-center justify-between border-b pb-4 border-white/10">
                <div>
                  <h3 className="text-lg font-bold">Gerenciamento de Agentes</h3>
                  <p className="text-xs text-[#8696a0]">Cadastre atendentes, supervisores e administradores.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAgentModal(true)}
                  className="px-3.5 py-2 bg-[#00a884] hover:bg-[#008069] text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adicionar Agente</span>
                </button>
              </div>

              {/* Agents Table / List */}
              <div className="divide-y divide-white/10">
                {agents.map((ag) => (
                  <div key={ag.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-full bg-[#2563eb] text-white font-bold text-xs flex items-center justify-center shrink-0">
                        {ag.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-xs font-bold flex items-center space-x-2">
                          <span>{ag.name}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              ag.role === 'Administrador'
                                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                : ag.role === 'Supervisor'
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            {ag.role}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#8696a0]">{ag.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span className="text-[11px] text-[#8696a0]">Capacidade: {ag.capacity} chats</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteAgent(ag.id)}
                        className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Remover agente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Agent Modal */}
              {showAgentModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                  <div
                    className={`w-full max-w-md rounded-2xl p-5 border shadow-2xl space-y-4 ${
                      isDarkMode ? 'bg-[#1f2c34] border-[#2a3942] text-white' : 'bg-white border-gray-200 text-[#111b21]'
                    }`}
                  >
                    <h3 className="text-base font-bold">Novo Agente</h3>
                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="text-[#8696a0] block mb-1 font-semibold">Nome Completo</label>
                        <input
                          type="text"
                          value={newAgentName}
                          onChange={(e) => setNewAgentName(e.target.value)}
                          placeholder="Ex: João Souza"
                          className={`w-full px-3 py-2 rounded-xl border outline-none ${
                            isDarkMode ? 'bg-[#202c33] border-[#2a3942]' : 'bg-[#f0f2f5] border-[#d1d7db]'
                          }`}
                        />
                      </div>
                      <div>
                        <label className="text-[#8696a0] block mb-1 font-semibold">Email corporativo</label>
                        <input
                          type="email"
                          value={newAgentEmail}
                          onChange={(e) => setNewAgentEmail(e.target.value)}
                          placeholder="joao@empresa.com"
                          className={`w-full px-3 py-2 rounded-xl border outline-none ${
                            isDarkMode ? 'bg-[#202c33] border-[#2a3942]' : 'bg-[#f0f2f5] border-[#d1d7db]'
                          }`}
                        />
                      </div>
                      <div>
                        <label className="text-[#8696a0] block mb-1 font-semibold">Função / Perfil</label>
                        <select
                          value={newAgentRole}
                          onChange={(e) => setNewAgentRole(e.target.value)}
                          className={`w-full px-3 py-2 rounded-xl border outline-none ${
                            isDarkMode ? 'bg-[#202c33] border-[#2a3942]' : 'bg-[#f0f2f5] border-[#d1d7db]'
                          }`}
                        >
                          <option value="Atendente">Atendente</option>
                          <option value="Supervisor">Supervisor</option>
                          <option value="Administrador">Administrador</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAgentModal(false)}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gray-500/20 text-gray-300 hover:bg-gray-500/30"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleAddAgent}
                        className="px-4 py-1.5 rounded-xl text-xs font-bold bg-[#00a884] text-white hover:bg-[#008069]"
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== 3. TIMES ==================== */}
          {activeTab === 'times' && (
            <div
              className={`p-6 rounded-2xl border shadow-xl space-y-6 ${
                isDarkMode ? 'bg-[#111b21] border-[#222d34]' : 'bg-white border-[#d1d7db]'
              }`}
            >
              <div className="flex items-center justify-between border-b pb-4 border-white/10">
                <div>
                  <h3 className="text-lg font-bold">Times & Equipes</h3>
                  <p className="text-xs text-[#8696a0]">Agrupe agentes em setores para distribuição automática de conversas.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTeamModal(true)}
                  className="px-3.5 py-2 bg-[#00a884] hover:bg-[#008069] text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Criar Time</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teams.map((tm) => (
                  <div
                    key={tm.id}
                    className={`p-4 rounded-xl border space-y-2 ${
                      isDarkMode ? 'bg-[#182228] border-[#2a3942]' : 'bg-[#f0f2f5] border-[#d1d7db]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm">{tm.name}</h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-bold">
                        {tm.members} membros
                      </span>
                    </div>
                    <p className="text-xs text-[#8696a0]">{tm.description}</p>
                    <div className="pt-2 flex items-center justify-between text-[11px] border-t border-white/5">
                      <span className="text-[#00a884] font-semibold">
                        {tm.autoAssign ? '✓ Distribuição automática ativa' : '• Atribuição manual'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {showTeamModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                  <div
                    className={`w-full max-w-md rounded-2xl p-5 border shadow-2xl space-y-4 ${
                      isDarkMode ? 'bg-[#1f2c34] border-[#2a3942] text-white' : 'bg-white border-gray-200 text-[#111b21]'
                    }`}
                  >
                    <h3 className="text-base font-bold">Novo Time</h3>
                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="text-[#8696a0] block mb-1 font-semibold">Nome do Time</label>
                        <input
                          type="text"
                          value={newTeamName}
                          onChange={(e) => setNewTeamName(e.target.value)}
                          placeholder="Ex: Suporte Técnico"
                          className={`w-full px-3 py-2 rounded-xl border outline-none ${
                            isDarkMode ? 'bg-[#202c33] border-[#2a3942]' : 'bg-[#f0f2f5] border-[#d1d7db]'
                          }`}
                        />
                      </div>
                      <div>
                        <label className="text-[#8696a0] block mb-1 font-semibold">Descrição</label>
                        <input
                          type="text"
                          value={newTeamDesc}
                          onChange={(e) => setNewTeamDesc(e.target.value)}
                          placeholder="Atendimento de dúvidas..."
                          className={`w-full px-3 py-2 rounded-xl border outline-none ${
                            isDarkMode ? 'bg-[#202c33] border-[#2a3942]' : 'bg-[#f0f2f5] border-[#d1d7db]'
                          }`}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowTeamModal(false)}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gray-500/20 text-gray-300"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleAddTeam}
                        className="px-4 py-1.5 rounded-xl text-xs font-bold bg-[#00a884] text-white"
                      >
                        Salvar Time
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== 4. CAIXAS DE ENTRADA ==================== */}
          {activeTab === 'caixas' && (
            <EvolutionInboxesPanel accountId={accountId} inboxes={chatwootInboxes} inboxesStatus={inboxesStatus} inboxesError={inboxesError} onRefresh={onRefreshInboxes} isDarkMode={isDarkMode} />
          )}

          {/* ==================== 5. ETIQUETAS ==================== */}
          {activeTab === 'etiquetas' && (
            <div
              className={`p-6 rounded-2xl border shadow-xl space-y-6 ${
                isDarkMode ? 'bg-[#111b21] border-[#222d34]' : 'bg-white border-[#d1d7db]'
              }`}
            >
              <div className="flex items-center justify-between border-b pb-4 border-white/10">
                <div>
                  <h3 className="text-lg font-bold">Etiquetas de Organização</h3>
                  <p className="text-xs text-[#8696a0]">Crie tags com cores customizadas para classificar conversas e contatos.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTagModal(true)}
                  className="px-3.5 py-2 bg-[#00a884] hover:bg-[#008069] text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Etiqueta</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-2.5">
                {tags.map((tg) => (
                  <div
                    key={tg.id}
                    className="px-3 py-1.5 rounded-xl border flex items-center space-x-2 text-xs font-semibold shadow-xs"
                    style={{
                      backgroundColor: `${tg.color}15`,
                      borderColor: `${tg.color}40`,
                      color: tg.color,
                    }}
                  >
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tg.color }} />
                    <span>{tg.label}</span>
                    <span className="text-[10px] opacity-70">({tg.count})</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteTag(tg.id)}
                      className="ml-1 hover:opacity-100 opacity-60 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {showTagModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                  <div
                    className={`w-full max-w-sm rounded-2xl p-5 border shadow-2xl space-y-4 ${
                      isDarkMode ? 'bg-[#1f2c34] border-[#2a3942] text-white' : 'bg-white border-gray-200 text-[#111b21]'
                    }`}
                  >
                    <h3 className="text-base font-bold">Nova Etiqueta</h3>
                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="text-[#8696a0] block mb-1 font-semibold">Nome da Etiqueta</label>
                        <input
                          type="text"
                          value={newTagLabel}
                          onChange={(e) => setNewTagLabel(e.target.value)}
                          placeholder="Ex: Cliente VIP"
                          className={`w-full px-3 py-2 rounded-xl border outline-none ${
                            isDarkMode ? 'bg-[#202c33] border-[#2a3942]' : 'bg-[#f0f2f5] border-[#d1d7db]'
                          }`}
                        />
                      </div>
                      <div>
                        <label className="text-[#8696a0] block mb-1 font-semibold">Cor de Identificação</label>
                        <input
                          type="color"
                          value={newTagColor}
                          onChange={(e) => setNewTagColor(e.target.value)}
                          className="w-full h-10 rounded-xl cursor-pointer bg-transparent border-none"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowTagModal(false)}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gray-500/20 text-gray-300"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleAddTag}
                        className="px-4 py-1.5 rounded-xl text-xs font-bold bg-[#00a884] text-white"
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== 6. ATRIBUTOS ==================== */}
          {activeTab === 'atributos' && (
            <div
              className={`p-6 rounded-2xl border shadow-xl space-y-6 ${
                isDarkMode ? 'bg-[#111b21] border-[#222d34]' : 'bg-white border-[#d1d7db]'
              }`}
            >
              <div className="flex items-center justify-between border-b pb-4 border-white/10">
                <div>
                  <h3 className="text-lg font-bold">Atributos Customizados</h3>
                  <p className="text-xs text-[#8696a0]">Campos personalizados para salvar dados específicos de contatos ou conversas.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAttributeModal(true)}
                  className="px-3.5 py-2 bg-[#00a884] hover:bg-[#008069] text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Atributo</span>
                </button>
              </div>

              <div className="divide-y divide-white/10">
                {attributes.map((attr) => (
                  <div key={attr.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono font-bold text-emerald-400">{attr.name}</span>
                      <p className="text-[11px] text-[#8696a0]">Chave: {attr.key}</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="px-2.5 py-1 rounded-lg bg-gray-500/10 border border-gray-500/20 text-gray-300 text-[10px] font-bold">
                        {attr.type}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold">
                        {attr.target}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {showAttributeModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                  <div
                    className={`w-full max-w-sm rounded-2xl p-5 border shadow-2xl space-y-4 ${
                      isDarkMode ? 'bg-[#1f2c34] border-[#2a3942] text-white' : 'bg-white border-gray-200 text-[#111b21]'
                    }`}
                  >
                    <h3 className="text-base font-bold">Novo Atributo Customizado</h3>
                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="text-[#8696a0] block mb-1 font-semibold">Nome / Chave do Campo</label>
                        <input
                          type="text"
                          value={newAttrKey}
                          onChange={(e) => setNewAttrKey(e.target.value)}
                          placeholder="Ex: CPF_CNPJ"
                          className={`w-full px-3 py-2 rounded-xl border outline-none ${
                            isDarkMode ? 'bg-[#202c33] border-[#2a3942]' : 'bg-[#f0f2f5] border-[#d1d7db]'
                          }`}
                        />
                      </div>
                      <div>
                        <label className="text-[#8696a0] block mb-1 font-semibold">Tipo de Dado</label>
                        <select
                          value={newAttrType}
                          onChange={(e) => setNewAttrType(e.target.value)}
                          className={`w-full px-3 py-2 rounded-xl border outline-none ${
                            isDarkMode ? 'bg-[#202c33] border-[#2a3942]' : 'bg-[#f0f2f5] border-[#d1d7db]'
                          }`}
                        >
                          <option value="Texto">Texto</option>
                          <option value="Número">Número</option>
                          <option value="Data">Data</option>
                          <option value="Opção">Opção / Booleano</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAttributeModal(false)}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gray-500/20 text-gray-300"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleAddAttribute}
                        className="px-4 py-1.5 rounded-xl text-xs font-bold bg-[#00a884] text-white"
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== KANBAN ==================== */}
          {activeTab === 'kanban' && (
            <div
              className={`p-6 rounded-2xl border shadow-xl space-y-6 ${
                isDarkMode ? 'bg-[#111b21] border-[#222d34]' : 'bg-white border-[#d1d7db]'
              }`}
            >
              <div className="flex items-center justify-between border-b pb-4 border-white/10">
                <div>
                  <h3 className="text-lg font-bold">Colunas do Kanban de Atendimento</h3>
                  <p className="text-xs text-[#8696a0]">Configure as etapas do funil de atendimento visual e atalhos.</p>
                </div>
                <button
                  type="button"
                  onClick={() => showToast('Nova coluna Kanban criada')}
                  className="px-3.5 py-2 bg-[#00a884] hover:bg-[#008069] text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Coluna</span>
                </button>
              </div>
              <div className="space-y-3">
                {[
                  { name: 'Aguardando Atendimento', color: '#f59e0b', count: 14 },
                  { name: 'Em Atendimento', color: '#3b82f6', count: 8 },
                  { name: 'Aguardando Resposta do Cliente', color: '#8b5cf6', count: 5 },
                  { name: 'Atendimento Concluído', color: '#00a884', count: 42 },
                ].map((col, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border flex items-center justify-between ${
                      isDarkMode ? 'bg-[#182228] border-[#2a3942]' : 'bg-[#f0f2f5] border-[#d1d7db]'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: col.color }} />
                      <span className="font-bold text-xs">{col.name}</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-[#8696a0]">{col.count} conversas</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==================== KANBAN CRM ==================== */}
          {activeTab === 'kanbancrm' && (
            <div
              className={`p-6 rounded-2xl border shadow-xl space-y-6 ${
                isDarkMode ? 'bg-[#111b21] border-[#222d34]' : 'bg-white border-[#d1d7db]'
              }`}
            >
              <div className="flex items-center justify-between border-b pb-4 border-white/10">
                <div>
                  <h3 className="text-lg font-bold">Kanban CRM & Funil de Vendas</h3>
                  <p className="text-xs text-[#8696a0]">Métricas de conversão, metas financeiras e fases de negociação comercial.</p>
                </div>
                <button
                  type="button"
                  onClick={() => showToast('Nova fase do funil CRM')}
                  className="px-3.5 py-2 bg-[#00a884] hover:bg-[#008069] text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Etapa CRM</span>
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Oportunidades Abertas', value: 'R$ 148.500', color: 'text-blue-400' },
                  { label: 'Propostas Enviadas', value: 'R$ 62.000', color: 'text-amber-400' },
                  { label: 'Vendas Fechadas (Mês)', value: 'R$ 89.200', color: 'text-emerald-400' },
                ].map((m, i) => (
                  <div
                    key={i}
                    className={`p-4 rounded-xl border ${
                      isDarkMode ? 'bg-[#182228] border-[#2a3942]' : 'bg-[#f0f2f5] border-[#d1d7db]'
                    }`}
                  >
                    <p className="text-xs text-[#8696a0] font-medium">{m.label}</p>
                    <p className={`text-lg font-bold mt-1 ${m.color}`}>{m.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==================== N8N ==================== */}
          {activeTab === 'n8n' && (
            <div
              className={`p-6 rounded-2xl border shadow-xl space-y-6 ${
                isDarkMode ? 'bg-[#111b21] border-[#222d34]' : 'bg-white border-[#d1d7db]'
              }`}
            >
              <div className="flex items-center justify-between border-b pb-4 border-white/10">
                <div>
                  <h3 className="text-lg font-bold">Integração N8N Automation</h3>
                  <p className="text-xs text-[#8696a0]">Conecte instâncias do N8N para automações avançadas via API.</p>
                </div>
                <button
                  type="button"
                  onClick={() => showToast('Testando conexão com N8N...')}
                  className="px-3.5 py-2 bg-[#00a884] hover:bg-[#008069] text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 cursor-pointer"
                >
                  <Zap className="w-4 h-4" />
                  <span>Testar N8N</span>
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-[#8696a0] block mb-1">URL da Instância N8N</label>
                  <input
                    type="text"
                    defaultValue="https://n8n.kopla.com.br/webhook/chat-events"
                    className={`w-full px-3.5 py-2 rounded-xl border text-xs outline-none ${
                      isDarkMode ? 'bg-[#202c33] border-[#2a3942] text-white' : 'bg-[#f0f2f5] border-[#d1d7db]'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#8696a0] block mb-1">Chave de API / Header Token</label>
                  <input
                    type="password"
                    defaultValue="n8n_sec_key_88392019203"
                    className={`w-full px-3.5 py-2 rounded-xl border text-xs outline-none ${
                      isDarkMode ? 'bg-[#202c33] border-[#2a3942] text-white' : 'bg-[#f0f2f5] border-[#d1d7db]'
                    }`}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ==================== BOTS ==================== */}
          {activeTab === 'bots' && (
            <div
              className={`p-6 rounded-2xl border shadow-xl space-y-6 ${
                isDarkMode ? 'bg-[#111b21] border-[#222d34]' : 'bg-white border-[#d1d7db]'
              }`}
            >
              <div className="flex items-center justify-between border-b pb-4 border-white/10">
                <div>
                  <h3 className="text-lg font-bold">Bots & Agentes de IA Inteligentes</h3>
                  <p className="text-xs text-[#8696a0]">Gerencie assistentes virtuais automatizados de Nível 1 e triagem.</p>
                </div>
                <button
                  type="button"
                  onClick={() => showToast('Criador de Novo Bot')}
                  className="px-3.5 py-2 bg-[#00a884] hover:bg-[#008069] text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Bot</span>
                </button>
              </div>
              <div className="space-y-3">
                {[
                  { name: 'Bot de Boas-Vindas & Triagem', type: 'Fluxo Estático', status: 'Ativo' },
                  { name: 'IA Atendente de Vendas Gemini', type: 'IA Generativa', status: 'Ativo' },
                  { name: 'Bot de Suporte Fora de Horário', type: 'Agendado', status: 'Pausado' },
                ].map((bot, i) => (
                  <div
                    key={i}
                    className={`p-4 rounded-xl border flex items-center justify-between ${
                      isDarkMode ? 'bg-[#182228] border-[#2a3942]' : 'bg-[#f0f2f5] border-[#d1d7db]'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-[#00a884]/20 text-[#00a884] flex items-center justify-center font-bold">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs">{bot.name}</h4>
                        <p className="text-[11px] text-[#8696a0]">{bot.type}</p>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        bot.status === 'Ativo' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'
                      }`}
                    >
                      {bot.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==================== 7. AUTOMAÇÃO ==================== */}
          {activeTab === 'automacao' && (
            <div
              className={`p-6 rounded-2xl border shadow-xl space-y-6 ${
                isDarkMode ? 'bg-[#111b21] border-[#222d34]' : 'bg-white border-[#d1d7db]'
              }`}
            >
              <div className="flex items-center justify-between border-b pb-4 border-white/10">
                <div>
                  <h3 className="text-lg font-bold">Regras de Automação</h3>
                  <p className="text-xs text-[#8696a0]">Gatilhos automáticos para encaminhar conversas, enviar avisos e alterar status.</p>
                </div>
                <button
                  type="button"
                  onClick={() => showToast('Iniciando criador de regra de automação...')}
                  className="px-3.5 py-2 bg-[#00a884] hover:bg-[#008069] text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Regra</span>
                </button>
              </div>

              <div className="space-y-3">
                {automations.map((aut) => (
                  <div
                    key={aut.id}
                    className={`p-4 rounded-xl border flex items-center justify-between ${
                      isDarkMode ? 'bg-[#182228] border-[#2a3942]' : 'bg-[#f0f2f5] border-[#d1d7db]'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                        <Repeat className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs">{aut.name}</h4>
                        <p className="text-[11px] text-[#8696a0]">Gatilho: {aut.trigger}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleAutomation(aut.id)}
                      className={`w-10 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                        aut.active ? 'bg-[#00a884]' : 'bg-gray-600'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform ${
                          aut.active ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==================== 8. MACROS ==================== */}
          {activeTab === 'macros' && (
            <div
              className={`p-6 rounded-2xl border shadow-xl space-y-6 ${
                isDarkMode ? 'bg-[#111b21] border-[#222d34]' : 'bg-white border-[#d1d7db]'
              }`}
            >
              <div className="flex items-center justify-between border-b pb-4 border-white/10">
                <div>
                  <h3 className="text-lg font-bold">Macros & Atalhos de Ação</h3>
                  <p className="text-xs text-[#8696a0]">Ações em lote executáveis com um único clique durante o atendimento.</p>
                </div>
                <button
                  type="button"
                  onClick={() => showToast('Criador de Macro em lote')}
                  className="px-3.5 py-2 bg-[#00a884] hover:bg-[#008069] text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Criar Macro</span>
                </button>
              </div>

              <div className="space-y-3">
                {macros.map((mc) => (
                  <div
                    key={mc.id}
                    className={`p-4 rounded-xl border flex items-center justify-between ${
                      isDarkMode ? 'bg-[#182228] border-[#2a3942]' : 'bg-[#f0f2f5] border-[#d1d7db]'
                    }`}
                  >
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-[#00a884]">{mc.name}</h4>
                      <p className="text-xs text-[#8696a0] mt-0.5">{mc.actions}</p>
                    </div>
                    <span className="text-[10px] px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 font-bold">
                      {mc.usage} execuções
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==================== 9. RESPOSTAS PRONTAS ==================== */}
          {activeTab === 'respostas' && (
            <div
              className={`p-6 rounded-2xl border shadow-xl space-y-6 ${
                isDarkMode ? 'bg-[#111b21] border-[#222d34]' : 'bg-white border-[#d1d7db]'
              }`}
            >
              <div className="flex items-center justify-between border-b pb-4 border-white/10">
                <div>
                  <h3 className="text-lg font-bold">Respostas Prontas</h3>
                  <p className="text-xs text-[#8696a0]">Atalhos rápidos com barras (ex: /boasvindas, /pix) para agilizar conversas.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowResponseModal(true)}
                  className="px-3.5 py-2 bg-[#00a884] hover:bg-[#008069] text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Resposta Pronta</span>
                </button>
              </div>

              <div className="space-y-3">
                {cannedResponses.map((cr) => (
                  <div
                    key={cr.id}
                    className={`p-4 rounded-xl border flex items-center justify-between ${
                      isDarkMode ? 'bg-[#182228] border-[#2a3942]' : 'bg-[#f0f2f5] border-[#d1d7db]'
                    }`}
                  >
                    <div className="space-y-1">
                      <span className="text-xs font-mono font-bold text-[#00a884] bg-[#00a884]/10 px-2 py-0.5 rounded-md border border-[#00a884]/20">
                        {cr.shortcut}
                      </span>
                      <p className="text-xs text-gray-300 leading-relaxed pt-1">{cr.content}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteResponse(cr.id)}
                      className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer shrink-0 ml-3"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {showResponseModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                  <div
                    className={`w-full max-w-md rounded-2xl p-5 border shadow-2xl space-y-4 ${
                      isDarkMode ? 'bg-[#1f2c34] border-[#2a3942] text-white' : 'bg-white border-gray-200 text-[#111b21]'
                    }`}
                  >
                    <h3 className="text-base font-bold">Nova Resposta Pronta</h3>
                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="text-[#8696a0] block mb-1 font-semibold">Atalho (Começa com /)</label>
                        <input
                          type="text"
                          value={newShortcut}
                          onChange={(e) => setNewShortcut(e.target.value)}
                          placeholder="Ex: /pix ou /boasvindas"
                          className={`w-full px-3 py-2 rounded-xl border outline-none ${
                            isDarkMode ? 'bg-[#202c33] border-[#2a3942]' : 'bg-[#f0f2f5] border-[#d1d7db]'
                          }`}
                        />
                      </div>
                      <div>
                        <label className="text-[#8696a0] block mb-1 font-semibold">Mensagem Completa</label>
                        <textarea
                          rows={3}
                          value={newContent}
                          onChange={(e) => setNewContent(e.target.value)}
                          placeholder="Digite o texto padronizado..."
                          className={`w-full px-3 py-2 rounded-xl border outline-none ${
                            isDarkMode ? 'bg-[#202c33] border-[#2a3942]' : 'bg-[#f0f2f5] border-[#d1d7db]'
                          }`}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowResponseModal(false)}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gray-500/20 text-gray-300"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleAddResponse}
                        className="px-4 py-1.5 rounded-xl text-xs font-bold bg-[#00a884] text-white"
                      >
                        Salvar Resposta
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== 10. MENSAGENS AGENDADAS ==================== */}
          {activeTab === 'agendadas' && (
            <div
              className={`p-6 rounded-2xl border shadow-xl space-y-6 ${
                isDarkMode ? 'bg-[#111b21] border-[#222d34]' : 'bg-white border-[#d1d7db]'
              }`}
            >
              <div className="flex items-center justify-between border-b pb-4 border-white/10">
                <div>
                  <h3 className="text-lg font-bold">Mensagens Agendadas</h3>
                  <p className="text-xs text-[#8696a0]">Fila de envios programados para contatos ou transmissões.</p>
                </div>
                <button
                  type="button"
                  onClick={() => showToast('Agendador de mensagem')}
                  className="px-3.5 py-2 bg-[#00a884] hover:bg-[#008069] text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Agendar Nova Mensagem</span>
                </button>
              </div>

              <div className="divide-y divide-white/10">
                {scheduledMessages.map((sm) => (
                  <div key={sm.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold flex items-center space-x-2">
                        <span>{sm.recipient}</span>
                        <span className="text-[10px] text-[#8696a0]">({sm.date})</span>
                      </div>
                      <p className="text-[#8696a0] mt-0.5">{sm.text}</p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        sm.status === 'Agendado'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {sm.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==================== 11. APLICAÇÕES ==================== */}
          {activeTab === 'aplicacoes' && (
            <div
              className={`p-6 rounded-2xl border shadow-xl space-y-6 ${
                isDarkMode ? 'bg-[#111b21] border-[#222d34]' : 'bg-white border-[#d1d7db]'
              }`}
            >
              <div className="flex items-center justify-between border-b pb-4 border-white/10">
                <div>
                  <h3 className="text-lg font-bold">Aplicações & Webhooks</h3>
                  <p className="text-xs text-[#8696a0]">Conectores de sistemas e URLs de callback HTTP/REST.</p>
                </div>
                <button
                  type="button"
                  onClick={() => showToast('Adicionar webhook')}
                  className="px-3.5 py-2 bg-[#00a884] hover:bg-[#008069] text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Webhook</span>
                </button>
              </div>

              <div className="space-y-3">
                {webhooks.map((wh) => (
                  <div
                    key={wh.id}
                    className={`p-4 rounded-xl border flex items-center justify-between ${
                      isDarkMode ? 'bg-[#182228] border-[#2a3942]' : 'bg-[#f0f2f5] border-[#d1d7db]'
                    }`}
                  >
                    <div>
                      <h4 className="font-bold text-xs">{wh.name}</h4>
                      <p className="text-[11px] font-mono text-[#8696a0] truncate max-w-md">{wh.url}</p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        wh.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'
                      }`}
                    >
                      {wh.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==================== 12. INTEGRAÇÕES ==================== */}
          {activeTab === 'integracoes' && (
            <div
              className={`p-6 rounded-2xl border shadow-xl space-y-6 ${
                isDarkMode ? 'bg-[#111b21] border-[#222d34]' : 'bg-white border-[#d1d7db]'
              }`}
            >
              <div className="border-b pb-4 border-white/10">
                <h3 className="text-lg font-bold">Integrações Nativas</h3>
                <p className="text-xs text-[#8696a0]">Conecte ferramentas de terceiros para automatizar fluxos de negócios.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { title: 'WhatsApp Cloud API (Meta)', desc: 'Conexão oficial da Meta com suporte a selo verde.', status: 'Conectado', active: true },
                  { title: 'Instagram Graph API', desc: 'Sincronização de Directs e comentários da conta.', status: 'Conectado', active: true },
                  { title: 'Google Calendar', desc: 'Agendamento de reuniões sincronizadas com contatos.', status: 'Disponível', active: false },
                  { title: 'Mercado Pago & Stripe', desc: 'Geração de links de pagamento direto no chat.', status: 'Disponível', active: false },
                ].map((ig, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border space-y-2 ${
                      isDarkMode ? 'bg-[#182228] border-[#2a3942]' : 'bg-[#f0f2f5] border-[#d1d7db]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs sm:text-sm">{ig.title}</h4>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          ig.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                        }`}
                      >
                        {ig.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#8696a0]">{ig.desc}</p>
                    <button
                      type="button"
                      onClick={() => showToast(`Configurando ${ig.title}`)}
                      className="w-full py-1.5 mt-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-semibold text-[#00a884] border border-[#00a884]/30 cursor-pointer"
                    >
                      {ig.active ? 'Gerenciar Conexão' : 'Conectar Agora'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==================== 13. REGISTROS DE AUDITORIA ==================== */}
          {activeTab === 'auditoria' && (
            <div
              className={`p-6 rounded-2xl border shadow-xl space-y-6 ${
                isDarkMode ? 'bg-[#111b21] border-[#222d34]' : 'bg-white border-[#d1d7db]'
              }`}
            >
              <div className="border-b pb-4 border-white/10">
                <h3 className="text-lg font-bold">Registros de Auditoria (Audit Logs)</h3>
                <p className="text-xs text-[#8696a0]">Histórico detalhado de alterações, exportações e acessos dos usuários.</p>
              </div>

              <div className="divide-y divide-white/10">
                {auditLogs.map((log) => (
                  <div key={log.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold flex items-center space-x-2">
                        <span>{log.user}</span>
                        <span className="text-[10px] text-[#8696a0]">• {log.time}</span>
                      </div>
                      <p className="text-gray-300 mt-0.5">{log.action}</p>
                    </div>
                    <span className="font-mono text-[10px] text-[#8696a0]">{log.ip}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==================== 14. PERMISSÕES ==================== */}
          {activeTab === 'permissoes' && (
            <div
              className={`p-6 rounded-2xl border shadow-xl space-y-6 ${
                isDarkMode ? 'bg-[#111b21] border-[#222d34]' : 'bg-white border-[#d1d7db]'
              }`}
            >
              <div className="border-b pb-4 border-white/10">
                <h3 className="text-lg font-bold">Matriz de Permissões & Níveis de Acesso</h3>
                <p className="text-xs text-[#8696a0]">Defina o que atendentes e supervisores podem acessar no sistema.</p>
              </div>

              <div className="space-y-3 text-xs">
                {[
                  { key: 'viewOtherChats', label: 'Ver conversas e atendimentos de outros agentes' },
                  { key: 'exportContacts', label: 'Exportar lista de contatos para arquivos CSV / JSON' },
                  { key: 'deleteMessages', label: 'Excluir mensagens ou apagar histórico de conversas' },
                  { key: 'manageSettings', label: 'Acessar e alterar painel de configurações do workspace' },
                  { key: 'manageAgents', label: 'Adicionar e remover novos agentes de atendimento' },
                  { key: 'assignChats', label: 'Reatribuir conversas manualmente para outros times' },
                ].map((item) => {
                  const permKey = item.key as keyof typeof permissions;
                  const isChecked = permissions[permKey];
                  return (
                    <div
                      key={item.key}
                      onClick={() => togglePermission(permKey)}
                      className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                        isDarkMode ? 'bg-[#182228] border-[#2a3942]' : 'bg-[#f0f2f5] border-[#d1d7db]'
                      }`}
                    >
                      <span className="font-medium">{item.label}</span>
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                          isChecked ? 'bg-[#00a884] text-white' : 'bg-gray-600/30 border border-gray-500'
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => showToast('Permissões salvas com sucesso!')}
                  className="px-5 py-2.5 bg-[#00a884] hover:bg-[#008069] text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                >
                  Salvar Permissões
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
