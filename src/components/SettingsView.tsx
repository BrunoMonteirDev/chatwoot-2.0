import React, { useEffect, useState } from 'react';
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
import type { CurrentUser, CustomRole, Inbox as ChatwootInbox } from '../domain/currentUser';
import type { AssignableAgent } from '../domain/currentUser';
import type { ConversationTeam } from '../domain/currentUser';
import { inboxService } from '../integrations/chatwoot/inboxes';
import { errorMessageForUser } from '../integrations/chatwoot/errors';
import {
  WALLPAPER_PRESETS,
  WallpaperId,
} from './WhatsAppDoodleBg';
import { EvolutionInboxesPanel } from './EvolutionInboxesPanel';
import { QuickNotesView } from './QuickNotesView';
import { PermissionProfilesPanel } from './PermissionProfilesPanel';
import { AgentInboxPermissionsModal } from './AgentInboxPermissionsModal';
import { browserNotifications, type BrowserNotificationState } from '../features/notifications/browserNotifications';
import { AutomationRulesPanel } from './AutomationRulesPanel';

export type SettingsTab =
  | 'perfil'
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

const CUSTOM_ROLE_PERMISSIONS = [
  ['conversation_manage', 'Gerenciar todas as conversas'],
  ['conversation_unassigned_manage', 'Gerenciar conversas não atribuídas'],
  ['conversation_participating_manage', 'Gerenciar conversas em que participa'],
  ['contact_manage', 'Gerenciar contatos'],
] as const;

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
  accountId?: number | null;
  inboxes?: ChatwootInbox[];
  inboxesStatus?: 'idle' | 'loading' | 'ready' | 'error';
  inboxesError?: string | null;
  onRefreshInboxes?: () => Promise<void> | void;
  profile?: CurrentUser | null;
  onSaveProfile?: (profile: { name: string; displayName: string; email: string; phoneNumber: string; messageSignature: string; showSystemMessages: boolean; currentPassword?: string; password?: string; passwordConfirmation?: string }) => Promise<void>;
  onResetAccessToken?: () => Promise<void>;
  selectedInboxId?: number | null;
  onOpenInbox?: (inboxId: number) => void;
}

export const SettingsView: React.FC<Props> = ({
  user,
  onUpdateUser,
  onClose,
  isDarkMode,
  onToggleDarkMode,
  wallpaperId,
  onSelectWallpaper,
  activeTab: propActiveTab,
  onTabChange: propOnTabChange,
  accountId = null,
  inboxes: chatwootInboxes = [],
  inboxesStatus = 'idle',
  inboxesError = null,
  onRefreshInboxes = () => undefined,
  profile = null,
  onSaveProfile,
  onResetAccessToken,
  selectedInboxId = null,
  onOpenInbox,
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
  const [profileName, setProfileName] = useState(profile?.name || user.name);
  const [profileDisplayName, setProfileDisplayName] = useState(profile?.displayName || user.name);
  const [profileEmail, setProfileEmail] = useState(profile?.email || '');
  const [profilePhone, setProfilePhone] = useState(profile?.phoneNumber || '');
  const [profileSignature, setProfileSignature] = useState(profile?.messageSignature || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [apiToken, setApiToken] = useState(profile?.apiAccessToken || '');
  const [browserNotificationState, setBrowserNotificationState] = useState<BrowserNotificationState>(() => browserNotifications.state());
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState(() => browserNotifications.enabled());
  const [showSystemMessages, setShowSystemMessages] = useState(() => profile?.uiSettings.show_system_messages !== false);

  useEffect(() => {
    setProfileName(profile?.name || user.name);
    setProfileDisplayName(profile?.displayName || user.name);
    setProfileEmail(profile?.email || '');
    setProfilePhone(profile?.phoneNumber || '');
    setProfileSignature(profile?.messageSignature || '');
    setApiToken(profile?.apiAccessToken || '');
    setShowSystemMessages(profile?.uiSettings.show_system_messages !== false);
  }, [profile, user]);

  const saveProfile = async () => {
    if (!onSaveProfile) return;
    if (newPassword && newPassword !== passwordConfirmation) { showToast('A confirmação da senha não confere.'); return; }
    setProfileSaving(true);
    try {
      await onSaveProfile({ name: profileName.trim(), displayName: profileDisplayName.trim(), email: profileEmail.trim(), phoneNumber: profilePhone.trim(), messageSignature: profileSignature, showSystemMessages, ...(newPassword ? { currentPassword, password: newPassword, passwordConfirmation } : {}) });
      onUpdateUser({ ...user, name: profileDisplayName.trim() || profileName.trim(), phone: profilePhone.trim(), about: profileSignature, avatar: profile?.avatarUrl || user.avatar });
      setCurrentPassword(''); setNewPassword(''); setPasswordConfirmation('');
      showToast('Perfil atualizado com sucesso.');
    } catch { showToast('Não foi possível atualizar o perfil. Verifique os dados e a senha atual.'); }
    finally { setProfileSaving(false); }
  };

  const resetToken = async () => {
    if (!onResetAccessToken || !window.confirm('Gerar um novo token invalida o token atual. Deseja continuar?')) return;
    try { await onResetAccessToken(); showToast('Novo token de API gerado.'); } catch { showToast('Não foi possível gerar um novo token.'); }
  };

  const toggleBrowserNotifications = async () => {
    if (browserNotifications.enabled()) {
      browserNotifications.disable();
      setBrowserNotificationsEnabled(false);
      return;
    }
    const state = await browserNotifications.enable();
    setBrowserNotificationState(state);
    setBrowserNotificationsEnabled(browserNotifications.enabled());
    if (state === 'denied') showToast('As notificações estão bloqueadas pelo navegador. Libere-as nas configurações do site.');
    if (state === 'unsupported') showToast('Este navegador não oferece suporte a notificações.');
  };

  // --- STATE FOR AGENTES ---
  const [agents, setAgents] = useState<AssignableAgent[]>([]);
  const [agentsStatus, setAgentsStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [agentQuery, setAgentQuery] = useState('');
  const [agentModal, setAgentModal] = useState<'create' | 'edit' | null>(null);
  const [agentSaving, setAgentSaving] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [editingAgent, setEditingAgent] = useState<AssignableAgent | null>(null);
  const [permissionsAgent, setPermissionsAgent] = useState<AssignableAgent | null>(null);
  const [agentForm, setAgentForm] = useState({ name: '', email: '', role: 'agent' as 'agent' | 'administrator', availability: 'online' as 'online' | 'offline' | 'busy', customRoleId: '' });
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [customRolesStatus, setCustomRolesStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');
  const [roleModal, setRoleModal] = useState<'create' | 'edit' | null>(null);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [roleForm, setRoleForm] = useState({ name: '', description: '', permissions: [] as string[] });
  const [accountTeams, setAccountTeams] = useState<ConversationTeam[]>([]);
  const [teamsStatus, setTeamsStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  useEffect(() => {
    if (activeTab !== 'agentes' || !accountId) return;
    let active = true;
    setAgentsStatus('loading');
    void inboxService.listAgents(accountId).then((result) => {
      if (!active) return;
      setAgents(result);
      setAgentsStatus('ready');
    }).catch(() => {
      if (active) setAgentsStatus('error');
    });
    return () => { active = false; };
  }, [accountId, activeTab]);

  const openCreateAgent = () => {
    setEditingAgent(null); setAgentError(null);
    setAgentForm({ name: '', email: '', role: 'agent', availability: 'online', customRoleId: '' });
    setAgentModal('create');
  };
  const openEditAgent = (agent: AssignableAgent) => {
    setEditingAgent(agent); setAgentError(null);
    setAgentForm({ name: agent.name, email: agent.email || '', role: agent.role === 'administrator' ? 'administrator' : 'agent', availability: agent.availability === 'busy' ? 'busy' : agent.availability === 'offline' ? 'offline' : 'online', customRoleId: agent.customRoleId ? String(agent.customRoleId) : '' });
    setAgentModal('edit');
  };
  const saveAgent = async () => {
    if (!accountId || !agentForm.name.trim() || (agentModal === 'create' && !agentForm.email.trim())) return;
    setAgentSaving(true); setAgentError(null);
    const params = { name: agentForm.name.trim(), email: agentForm.email.trim(), role: agentModal === 'create' ? 'agent' as const : editingAgent?.role === 'administrator' ? 'administrator' as const : 'agent' as const, availability: agentForm.availability, customRoleId: null };
    try {
      const saved = agentModal === 'create'
        ? await inboxService.createAgent(accountId, params)
        : await inboxService.updateAgent(accountId, editingAgent!.id, params);
      setAgents(current => agentModal === 'create' ? [...current, saved] : current.map(agent => agent.id === saved.id ? saved : agent));
      setAgentModal(null); showToast(agentModal === 'create' ? 'Agente adicionado com sucesso.' : 'Agente atualizado com sucesso.');
    } catch (cause) { setAgentError(errorMessageForUser(cause)); }
    finally { setAgentSaving(false); }
  };
  const deleteAgent = async (agent: AssignableAgent) => {
    if (!accountId || !window.confirm(`Excluir o agente ${agent.name}? Ele perderá o acesso a esta conta.`)) return;
    try { await inboxService.deleteAgent(accountId, agent.id); setAgents(current => current.filter(item => item.id !== agent.id)); showToast('Agente excluído da conta.'); }
    catch (cause) { showToast(errorMessageForUser(cause)); }
  };
  const openCreateRole = () => { setEditingRole(null); setRoleError(null); setRoleForm({ name: '', description: '', permissions: [] }); setRoleModal('create'); };
  const openEditRole = (role: CustomRole) => { setEditingRole(role); setRoleError(null); setRoleForm({ name: role.name, description: role.description || '', permissions: role.permissions.filter(permission => CUSTOM_ROLE_PERMISSIONS.some(([key]) => key === permission)) }); setRoleModal('edit'); };
  const toggleRolePermission = (permission: string) => setRoleForm(current => ({ ...current, permissions: current.permissions.includes(permission) ? current.permissions.filter(item => item !== permission) : [...current.permissions, permission] }));
  const saveRole = async () => {
    if (!accountId || !roleForm.name.trim()) return;
    setRoleSaving(true); setRoleError(null);
    try {
      const params = { name: roleForm.name.trim(), description: roleForm.description.trim(), permissions: roleForm.permissions };
      const saved = roleModal === 'create' ? await inboxService.createCustomRole(accountId, params) : await inboxService.updateCustomRole(accountId, editingRole!.id, params);
      setCustomRoles(current => roleModal === 'create' ? [...current, saved] : current.map(role => role.id === saved.id ? saved : role));
      setRoleModal(null); showToast(roleModal === 'create' ? 'Função criada com sucesso.' : 'Função atualizada com sucesso.');
    } catch (cause) { setRoleError(errorMessageForUser(cause)); }
    finally { setRoleSaving(false); }
  };
  const deleteRole = async (role: CustomRole) => {
    if (!accountId || !window.confirm(`Excluir a função ${role.name}? Agentes vinculados voltarão ao padrão.`)) return;
    try { await inboxService.deleteCustomRole(accountId, role.id); setCustomRoles(current => current.filter(item => item.id !== role.id)); setAgents(current => current.map(agent => agent.customRoleId === role.id ? { ...agent, customRoleId: null } : agent)); showToast('Função excluída.'); }
    catch (cause) { showToast(errorMessageForUser(cause)); }
  };

  useEffect(() => {
    if (activeTab !== 'times' || !accountId) return;
    let active = true;
    setTeamsStatus('loading');
    void inboxService.listTeams(accountId).then((result) => {
      if (!active) return;
      setAccountTeams(result);
      setTeamsStatus('ready');
    }).catch(() => {
      if (active) setTeamsStatus('error');
    });
    return () => { active = false; };
  }, [accountId, activeTab]);

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
  const [webhooks] = useState([
    { id: '1', name: 'Webhook CRM Interno', url: 'https://api.kopla.com.br/webhooks/chats', active: true },
    { id: '2', name: 'Notificações operacionais', url: 'https://hooks.exemplo.com/atendimento', active: false },
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
          {/* ==================== 0. PERFIL ==================== */}
          {activeTab === 'perfil' && (
            <div className={`p-6 rounded-2xl border shadow-xl space-y-6 ${isDarkMode ? 'bg-[#111b21] border-[#222d34]' : 'bg-white border-[#d1d7db]'}`}>
              <div className="flex items-center justify-between border-b pb-4 border-white/10">
                <div><h3 className="text-lg font-bold">Configurações do Perfil</h3><p className="text-xs text-[#8696a0]">Dados pessoais, notificações, segurança e acesso à API.</p></div>
                <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-[#2563eb] font-bold text-white">{profile?.avatarUrl ? <img src={profile.avatarUrl} alt="Perfil" className="h-full w-full object-cover" /> : (profileDisplayName || profileName || 'U').slice(0, 2).toUpperCase()}</div>
              </div>

              <section className="space-y-4">
                <h4 className="flex items-center gap-2 text-sm font-bold"><User className="h-4 w-4 text-[#00a884]" />Informações pessoais</h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {[['Nome completo', profileName, setProfileName], ['Nome para exibição', profileDisplayName, setProfileDisplayName], ['E-mail', profileEmail, setProfileEmail], ['Telefone', profilePhone, setProfilePhone]].map(([label, value, setter]) => (
                    <label key={label as string} className="space-y-1.5"><span className="text-xs font-semibold text-[#8696a0]">{label as string}</span><input value={value as string} type={label === 'E-mail' ? 'email' : 'text'} onChange={(event) => (setter as (value: string) => void)(event.target.value)} className={`w-full rounded-xl border px-3.5 py-2 text-sm outline-none ${isDarkMode ? 'border-[#2a3942] bg-[#202c33] text-white' : 'border-[#d1d7db] bg-[#f0f2f5]'}`} /></label>
                  ))}
                </div>
                <label className="block space-y-1.5"><span className="text-xs font-semibold text-[#8696a0]">Assinatura de mensagens</span><textarea value={profileSignature} onChange={(event) => setProfileSignature(event.target.value)} placeholder="Assinatura opcional ao final das mensagens" rows={3} className={`w-full resize-none rounded-xl border px-3.5 py-2 text-sm outline-none ${isDarkMode ? 'border-[#2a3942] bg-[#202c33] text-white' : 'border-[#d1d7db] bg-[#f0f2f5]'}`} /></label>
              </section>

              <section className="space-y-3 border-t border-white/10 pt-5">
                <h4 className="flex items-center gap-2 text-sm font-bold"><Bell className="h-4 w-4 text-[#00a884]" />Preferências</h4>
                <div className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-sm ${isDarkMode ? 'border-[#2a3942] bg-[#182228]' : 'border-[#d1d7db] bg-[#f8f9fa]'}`}><div><span className="block">Notificações no navegador</span><span className="mt-1 block text-xs text-[#8696a0]">Alertas de novas mensagens quando o Kopla estiver em segundo plano.</span></div><button type="button" disabled={browserNotificationState === 'unsupported' || browserNotificationState === 'denied'} onClick={() => void toggleBrowserNotifications()} className={`rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50 ${browserNotificationsEnabled ? 'bg-[#00a884] text-white' : 'border border-[#00a884] text-[#00a884]'}`}>{browserNotificationsEnabled ? 'Ativadas' : browserNotificationState === 'denied' ? 'Bloqueadas' : 'Ativar'}</button></div>
                <button type="button" onClick={() => setShowSystemMessages((current) => !current)} className={`flex w-full items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left text-sm ${isDarkMode ? 'border-[#2a3942] bg-[#182228]' : 'border-[#d1d7db] bg-[#f8f9fa]'}`}><span><span className="block">Mostrar mensagens do sistema</span><span className="mt-1 block text-xs text-[#8696a0]">Exibe eventos como atribuições, etiquetas e mudanças de status na conversa.</span></span><span className={`rounded-lg px-3 py-2 text-xs font-bold ${showSystemMessages ? 'bg-[#00a884] text-white' : 'border border-[#8696a0] text-[#667781]'}`}>{showSystemMessages ? 'Ligado' : 'Desligado'}</span></button>
                <button type="button" onClick={onToggleDarkMode} className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm ${isDarkMode ? 'border-[#2a3942] bg-[#182228]' : 'border-[#d1d7db] bg-[#f8f9fa]'}`}><span className="flex items-center gap-2"><Palette className="h-4 w-4 text-[#00a884]" />Tema</span><span>{isDarkMode ? 'Escuro' : 'Claro'}</span></button>
              </section>

              <section className="space-y-3 border-t border-white/10 pt-5">
                <h4 className="flex items-center gap-2 text-sm font-bold"><Key className="h-4 w-4 text-[#00a884]" />Token de acesso à API</h4>
                <p className="text-xs text-[#8696a0]">Use este token apenas em integrações seguras. Ao gerar outro, o token atual deixa de funcionar.</p>
                <div className="flex gap-2"><input readOnly type="password" value={apiToken} placeholder="Token indisponível para esta conta" className={`min-w-0 flex-1 rounded-xl border px-3.5 py-2 text-sm outline-none ${isDarkMode ? 'border-[#2a3942] bg-[#202c33] text-white' : 'border-[#d1d7db] bg-[#f0f2f5]'}`} /><button type="button" disabled={!apiToken} onClick={() => void navigator.clipboard.writeText(apiToken).then(() => showToast('Token copiado.'))} className="rounded-xl border border-[#00a884] px-3 text-xs font-bold text-[#00a884] disabled:opacity-40">Copiar</button><button type="button" onClick={() => void resetToken()} className="rounded-xl bg-[#00a884] px-3 text-xs font-bold text-white">Gerar novo</button></div>
              </section>

              <section className="space-y-4 border-t border-white/10 pt-5">
                <h4 className="flex items-center gap-2 text-sm font-bold"><Lock className="h-4 w-4 text-[#00a884]" />Senha</h4>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3"><input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Senha atual" className={`rounded-xl border px-3.5 py-2 text-sm outline-none ${isDarkMode ? 'border-[#2a3942] bg-[#202c33] text-white' : 'border-[#d1d7db] bg-[#f0f2f5]'}`} /><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Nova senha" className={`rounded-xl border px-3.5 py-2 text-sm outline-none ${isDarkMode ? 'border-[#2a3942] bg-[#202c33] text-white' : 'border-[#d1d7db] bg-[#f0f2f5]'}`} /><input type="password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} placeholder="Confirmar nova senha" className={`rounded-xl border px-3.5 py-2 text-sm outline-none ${isDarkMode ? 'border-[#2a3942] bg-[#202c33] text-white' : 'border-[#d1d7db] bg-[#f0f2f5]'}`} /></div>
              </section>

              <div className="flex justify-end border-t border-white/10 pt-5"><button type="button" disabled={profileSaving} onClick={() => void saveProfile()} className="rounded-xl bg-[#00a884] px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50">{profileSaving ? 'Salvando…' : 'Salvar perfil'}</button></div>
            </div>
          )}

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
                  <p className="text-xs text-[#8696a0]">Gerencie informações e preferências compartilhadas da conta.</p>
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
                  <p className="text-xs text-[#8696a0]">Agentes vinculados a esta conta no Chatwoot.</p>
                </div>
                <button type="button" onClick={openCreateAgent} disabled={!accountId} className="rounded-xl bg-[#00a884] px-3.5 py-2 text-xs font-bold text-white disabled:opacity-40 flex items-center gap-1.5"><Plus className="w-4 h-4" />Adicionar agente</button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className={`flex w-full max-w-sm items-center gap-2 rounded-xl border px-3 py-2 ${isDarkMode ? 'border-[#2a3942] bg-[#182228]' : 'border-[#d1d7db] bg-gray-50'}`}>
                  <Search className="h-4 w-4 text-[#8696a0]" /><input value={agentQuery} onChange={(event) => setAgentQuery(event.target.value)} placeholder="Pesquisar por nome ou e-mail" className="w-full bg-transparent text-xs outline-none" />
                </label>
                <span className="text-[11px] text-[#8696a0]">{customRolesStatus === 'ready' ? `${customRoles.length} funções personalizadas disponíveis` : customRolesStatus === 'unavailable' ? 'Funções personalizadas indisponíveis nesta conta' : ''}</span>
              </div>

              <div className="divide-y divide-white/10">
                {agentsStatus === 'loading' && <p className="py-6 text-center text-xs text-[#8696a0]">Carregando agentes…</p>}
                {agentsStatus === 'error' && <p className="py-6 text-center text-xs text-red-400">Não foi possível carregar os agentes desta conta.</p>}
                {agentsStatus === 'ready' && agents.length === 0 && <p className="py-6 text-center text-xs text-[#8696a0]">Nenhum agente está vinculado a esta conta.</p>}
                {agents.filter((agent) => `${agent.name} ${agent.email || ''}`.toLocaleLowerCase().includes(agentQuery.trim().toLocaleLowerCase())).map((ag) => (
                  <div key={ag.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-full bg-[#2563eb] text-white font-bold text-xs flex items-center justify-center shrink-0">
                        {ag.avatarUrl ? <img src={ag.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" /> : ag.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-xs font-bold flex items-center space-x-2">
                          <span>{ag.name}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              ag.role === 'administrator'
                                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                : ag.role === 'supervisor'
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            {ag.role === 'administrator' ? 'Administrador' : ag.role === 'supervisor' ? 'Supervisor' : ag.role === 'agent' ? 'Atendente' : ag.role || 'Agente'}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#8696a0]">{ag.email || 'Sem e-mail disponível'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3"><span className="text-[11px] text-[#8696a0]">{ag.availability === 'online' ? 'Disponível' : ag.availability === 'busy' ? 'Ocupado' : ag.availability === 'offline' ? 'Offline' : ag.availability || ''}</span><button type="button" onClick={() => setPermissionsAgent(ag)} title="Inboxes e permissões" className="rounded-lg p-2 text-[#8696a0] hover:bg-white/10 hover:text-[#00a884]"><ShieldCheck className="h-4 w-4" /></button><button type="button" onClick={() => openEditAgent(ag)} title="Editar agente" className="rounded-lg p-2 text-[#8696a0] hover:bg-white/10 hover:text-[#00a884]"><Edit3 className="h-4 w-4" /></button><button type="button" onClick={() => void deleteAgent(ag)} title="Excluir agente" className="rounded-lg p-2 text-[#8696a0] hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-4 w-4" /></button></div>
                  </div>
                ))}
                {agentsStatus === 'ready' && agents.length > 0 && !agents.some((agent) => `${agent.name} ${agent.email || ''}`.toLocaleLowerCase().includes(agentQuery.trim().toLocaleLowerCase())) && <p className="py-6 text-center text-xs text-[#8696a0]">Nenhum agente encontrado.</p>}
              </div>

              {agentModal && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/65 p-4" role="dialog" aria-modal="true"><div className={`w-full max-w-md rounded-2xl border p-5 shadow-2xl ${isDarkMode ? 'border-[#2a3942] bg-[#182228]' : 'border-[#d1d7db] bg-white'}`}><div className="flex items-center justify-between"><h3 className="text-base font-bold">{agentModal === 'create' ? 'Adicionar agente' : `Editar agente · ${editingAgent?.name}`}</h3><button type="button" onClick={() => setAgentModal(null)} className="text-[#8696a0]"><X className="h-4 w-4" /></button></div><p className="mt-1 text-xs text-[#8696a0]">A disponibilidade é independente dos perfis de permissão.</p>{agentError && <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">{agentError}</p>}<div className="mt-4 space-y-3"><label className="block text-xs font-semibold">Nome<input value={agentForm.name} onChange={(event) => setAgentForm(current => ({ ...current, name: event.target.value }))} className={`mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${isDarkMode ? 'border-[#2a3942] bg-[#111b21]' : 'border-[#d1d7db] bg-gray-50'}`} /></label><label className="block text-xs font-semibold">E-mail<input type="email" disabled={agentModal === 'edit'} value={agentForm.email} onChange={(event) => setAgentForm(current => ({ ...current, email: event.target.value }))} className={`mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm outline-none disabled:opacity-60 ${isDarkMode ? 'border-[#2a3942] bg-[#111b21]' : 'border-[#d1d7db] bg-gray-50'}`} /></label><label className="block text-xs font-semibold">Disponibilidade<select value={agentForm.availability} onChange={(event) => setAgentForm(current => ({ ...current, availability: event.target.value as 'online' | 'offline' | 'busy' }))} className={`mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${isDarkMode ? 'border-[#2a3942] bg-[#111b21]' : 'border-[#d1d7db] bg-gray-50'}`}><option value="online">Disponível</option><option value="offline">Offline</option><option value="busy">Ocupado</option></select></label></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setAgentModal(null)} className="rounded-xl px-3 py-2 text-xs font-bold text-[#8696a0]">Cancelar</button><button type="button" disabled={agentSaving || !agentForm.name.trim() || (agentModal === 'create' && !agentForm.email.trim())} onClick={() => void saveAgent()} className="rounded-xl bg-[#00a884] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{agentSaving ? 'Salvando…' : agentModal === 'create' ? 'Adicionar agente' : 'Salvar alterações'}</button></div></div></div>}
              {permissionsAgent && accountId && <AgentInboxPermissionsModal accountId={accountId} agent={permissionsAgent} onClose={() => setPermissionsAgent(null)} isDarkMode={isDarkMode} />}
              {roleModal && <div className="fixed inset-0 z-[101] grid place-items-center bg-black/65 p-4" role="dialog" aria-modal="true"><div className={`w-full max-w-lg rounded-2xl border p-5 shadow-2xl ${isDarkMode ? 'border-[#2a3942] bg-[#182228]' : 'border-[#d1d7db] bg-white'}`}><div className="flex items-center justify-between"><h3 className="text-base font-bold">{roleModal === 'create' ? 'Nova função personalizada' : 'Editar função personalizada'}</h3><button type="button" onClick={() => setRoleModal(null)} className="text-[#8696a0]"><X className="h-4 w-4" /></button></div>{roleError && <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">{roleError}</p>}<div className="mt-4 space-y-3"><label className="block text-xs font-semibold">Nome<input value={roleForm.name} onChange={(event) => setRoleForm(current => ({ ...current, name: event.target.value }))} className={`mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${isDarkMode ? 'border-[#2a3942] bg-[#111b21]' : 'border-[#d1d7db] bg-gray-50'}`} /></label><label className="block text-xs font-semibold">Descrição<textarea value={roleForm.description} onChange={(event) => setRoleForm(current => ({ ...current, description: event.target.value }))} className={`mt-1.5 min-h-20 w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${isDarkMode ? 'border-[#2a3942] bg-[#111b21]' : 'border-[#d1d7db] bg-gray-50'}`} /></label><fieldset><legend className="text-xs font-semibold">Permissões</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{CUSTOM_ROLE_PERMISSIONS.map(([key, label]) => <label key={key} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={roleForm.permissions.includes(key)} onChange={() => toggleRolePermission(key)} />{label}</label>)}</div></fieldset></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setRoleModal(null)} className="rounded-xl px-3 py-2 text-xs font-bold text-[#8696a0]">Cancelar</button><button type="button" disabled={roleSaving || !roleForm.name.trim()} onClick={() => void saveRole()} className="rounded-xl bg-[#00a884] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{roleSaving ? 'Salvando…' : 'Salvar função'}</button></div></div></div>}
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
                  <p className="text-xs text-[#8696a0]">Times reais desta conta no Chatwoot.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teamsStatus === 'loading' && <p className="col-span-full py-6 text-center text-xs text-[#8696a0]">Carregando times…</p>}
                {teamsStatus === 'error' && <p className="col-span-full py-6 text-center text-xs text-red-400">Não foi possível carregar os times desta conta.</p>}
                {teamsStatus === 'ready' && accountTeams.length === 0 && <p className="col-span-full py-6 text-center text-xs text-[#8696a0]">Nenhum time está cadastrado nesta conta.</p>}
                {accountTeams.map((tm) => (
                  <div
                    key={tm.id}
                    className={`p-4 rounded-xl border space-y-2 ${
                      isDarkMode ? 'bg-[#182228] border-[#2a3942]' : 'bg-[#f0f2f5] border-[#d1d7db]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm">{tm.name}</h4>
                    </div>
                    <p className="text-xs text-[#8696a0]">Disponível para atribuição de conversas.</p>
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
            <EvolutionInboxesPanel accountId={accountId} inboxes={chatwootInboxes} inboxesStatus={inboxesStatus} inboxesError={inboxesError} onRefresh={onRefreshInboxes} isDarkMode={isDarkMode} selectedInboxId={selectedInboxId} onOpenInbox={onOpenInbox} />
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
            <AutomationRulesPanel accountId={accountId} inboxes={chatwootInboxes} isDarkMode={isDarkMode} />
          )}
          {false && activeTab === 'automacao' && (
            <div className={`p-6 rounded-2xl border shadow-xl space-y-6 ${isDarkMode ? 'bg-[#111b21] border-[#222d34]' : 'bg-white border-[#d1d7db]'}`}>
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
          {activeTab === 'respostas' && <QuickNotesView isDarkMode={isDarkMode} embedded />}

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
          {activeTab === 'integracoes' && (
            <div
              className={`p-6 rounded-2xl border shadow-xl space-y-6 ${
                isDarkMode ? 'bg-[#111b21] border-[#222d34]' : 'bg-white border-[#d1d7db]'
              }`}
            >
              <div className="flex items-center justify-between border-b pb-4 border-white/10">
                <div>
                  <h3 className="text-lg font-bold">Integrações e aplicativos</h3>
                  <p className="text-xs text-[#8696a0]">Webhooks, Painel de Apps e Aplicações Autônomas. Outros conectores não fazem parte deste produto.</p>
                </div>
                <button
                  type="button"
                  onClick={() => showToast('Adicionar webhook')}
                  className="px-3.5 py-2 bg-[#00a884] hover:bg-[#008069] text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo webhook</span>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#182228] border-[#2a3942]' : 'bg-[#f0f2f5] border-[#d1d7db]'}`}>
                  <div className="flex items-center justify-between gap-3"><div><h4 className="font-bold text-sm">Painel de Apps</h4><p className="text-xs text-[#8696a0] mt-1">Instale e organize os apps permitidos para o atendimento.</p></div><LayoutGrid className="w-5 h-5 text-[#00a884]" /></div>
                  <button type="button" onClick={() => showToast('Painel de Apps aberto')} className="mt-3 text-xs font-bold text-[#00a884] hover:underline cursor-pointer">Gerenciar painel</button>
                </div>
                <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#182228] border-[#2a3942]' : 'bg-[#f0f2f5] border-[#d1d7db]'}`}>
                  <div className="flex items-center justify-between gap-3"><div><h4 className="font-bold text-sm">Aplicações Autônomas</h4><p className="text-xs text-[#8696a0] mt-1">Aplicativos externos exibidos com contexto da conversa.</p></div><ExternalLink className="w-5 h-5 text-[#00a884]" /></div>
                  <button type="button" onClick={() => showToast('Aplicações Autônomas abertas')} className="mt-3 text-xs font-bold text-[#00a884] hover:underline cursor-pointer">Gerenciar aplicações</button>
                </div>
              </div>
            </div>
          )}

          {/* ==================== 12. INTEGRAÇÕES ==================== */}
          {activeTab === 'aplicacoes' && (
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
            <PermissionProfilesPanel accountId={accountId} isDarkMode={isDarkMode} />
          )}
        </div>
      </div>
    </div>
  );
};
