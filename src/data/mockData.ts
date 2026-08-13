import { Chat, StatusItem, CallLog, UserProfile } from '../types';

// SVG Data URIs for realistic CRM / List screenshots matching the reference image
export const mockListImages = {
  crmLists: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="420" viewBox="0 0 600 420" fill="none">
    <rect width="600" height="420" rx="8" fill="%230f172a"/>
    <rect x="16" y="16" width="568" height="38" rx="6" fill="%231e293b"/>
    <text x="32" y="40" fill="%2394a3b8" font-family="sans-serif" font-size="13">6 Pastas  8 Listas  0 Tarefa</text>
    <rect x="16" y="66" width="568" height="32" rx="4" fill="%231e293b" stroke="%23334155"/>
    <text x="32" y="87" fill="%2364748b" font-family="sans-serif" font-size="12">🔍 Filtrar...</text>
    
    <text x="32" y="125" fill="%2364748b" font-family="sans-serif" font-size="11" font-weight="bold">PASTAS COMPARTILHADAS</text>
    <text x="480" y="125" fill="%23ef4444" font-family="sans-serif" font-size="11">Remover tudo</text>
    
    <rect x="32" y="140" width="536" height="40" rx="4" fill="%231e293b"/>
    <text x="48" y="165" fill="%23f8fafc" font-family="sans-serif" font-size="13">Comercial / CRM Vendas</text>
    <rect x="420" y="150" width="110" height="22" rx="4" fill="%230284c7"/>
    <text x="430" y="165" fill="%23ffffff" font-family="sans-serif" font-size="11">Apenas exibição ⌄</text>

    <rect x="32" y="190" width="536" height="40" rx="4" fill="%231e293b"/>
    <text x="48" y="215" fill="%23f8fafc" font-family="sans-serif" font-size="13">Comercial / CRM Upgrades</text>
    <rect x="420" y="200" width="110" height="22" rx="4" fill="%230284c7"/>
    <text x="430" y="215" fill="%23ffffff" font-family="sans-serif" font-size="11">Apenas exibição ⌄</text>

    <rect x="32" y="240" width="536" height="40" rx="4" fill="%231e293b"/>
    <text x="48" y="265" fill="%23f8fafc" font-family="sans-serif" font-size="13">Comercial / CRM Eventos</text>
    <rect x="420" y="250" width="110" height="22" rx="4" fill="%230284c7"/>
    <text x="430" y="265" fill="%23ffffff" font-family="sans-serif" font-size="11">Apenas exibição ⌄</text>

    <rect x="32" y="290" width="536" height="40" rx="4" fill="%231e293b"/>
    <text x="48" y="315" fill="%23f8fafc" font-family="sans-serif" font-size="13">Financeiro / Dados Importados</text>
    <rect x="420" y="300" width="110" height="22" rx="4" fill="%230284c7"/>
    <text x="430" y="315" fill="%23ffffff" font-family="sans-serif" font-size="11">Apenas exibição ⌄</text>

    <rect x="32" y="340" width="536" height="40" rx="4" fill="%231e293b"/>
    <text x="48" y="365" fill="%23f8fafc" font-family="sans-serif" font-size="13">Comercial / Prospecção PJ</text>
    <rect x="420" y="350" width="110" height="22" rx="4" fill="%230284c7"/>
    <text x="430" y="365" fill="%23ffffff" font-family="sans-serif" font-size="11">Apenas exibição ⌄</text>
  </svg>`,

  sharedLists1: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="420" viewBox="0 0 600 420" fill="none">
    <rect width="600" height="420" rx="8" fill="%230f172a"/>
    <rect x="16" y="16" width="568" height="38" rx="6" fill="%231e293b"/>
    <text x="32" y="40" fill="%2394a3b8" font-family="sans-serif" font-size="13">8 Listas  0 Tarefa</text>
    <rect x="16" y="66" width="568" height="32" rx="4" fill="%231e293b" stroke="%23334155"/>
    <text x="32" y="87" fill="%2364748b" font-family="sans-serif" font-size="12">🔍 Filtrar...</text>
    
    <text x="32" y="125" fill="%2364748b" font-family="sans-serif" font-size="11" font-weight="bold">LISTAS COMPARTILHADAS</text>
    <text x="480" y="125" fill="%23ef4444" font-family="sans-serif" font-size="11">Remover tudo</text>
    
    <rect x="32" y="140" width="536" height="36" rx="4" fill="%231e293b"/>
    <text x="48" y="162" fill="%23cbd5e1" font-family="sans-serif" font-size="12">Técnico / Instalações</text>

    <rect x="32" y="182" width="536" height="36" rx="4" fill="%231e293b"/>
    <text x="48" y="204" fill="%2338bdf8" font-family="sans-serif" font-size="12" font-weight="bold">Técnico / Ativação</text>

    <rect x="32" y="224" width="536" height="36" rx="4" fill="%231e293b"/>
    <text x="48" y="246" fill="%23cbd5e1" font-family="sans-serif" font-size="12">Técnico / Telefonia</text>

    <rect x="32" y="266" width="536" height="36" rx="4" fill="%231e293b"/>
    <text x="48" y="288" fill="%23cbd5e1" font-family="sans-serif" font-size="12">Técnico / Aplicativos</text>

    <rect x="32" y="308" width="536" height="36" rx="4" fill="%231e293b"/>
    <text x="48" y="330" fill="%23cbd5e1" font-family="sans-serif" font-size="12">Técnico / Inviabilidade</text>

    <rect x="32" y="350" width="536" height="36" rx="4" fill="%231e293b"/>
    <text x="48" y="372" fill="%23cbd5e1" font-family="sans-serif" font-size="12">Técnico / Técnico Upgrade</text>
  </svg>`,

  sharedLists2: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="420" viewBox="0 0 600 420" fill="none">
    <rect width="600" height="420" rx="8" fill="%230f172a"/>
    <rect x="16" y="16" width="568" height="38" rx="6" fill="%231e293b"/>
    <text x="32" y="40" fill="%2394a3b8" font-family="sans-serif" font-size="13">8 Listas  0 Tarefa</text>

    <rect x="32" y="70" width="536" height="36" rx="4" fill="%231e293b"/>
    <text x="48" y="92" fill="%23cbd5e1" font-family="sans-serif" font-size="12">Técnico / Aplicativos</text>

    <rect x="32" y="112" width="536" height="36" rx="4" fill="%231e293b"/>
    <text x="48" y="134" fill="%23cbd5e1" font-family="sans-serif" font-size="12">Técnico / Telefonia</text>

    <rect x="32" y="154" width="536" height="36" rx="4" fill="%231e293b"/>
    <text x="48" y="176" fill="%23cbd5e1" font-family="sans-serif" font-size="12">Técnico / Inviabilidade</text>

    <rect x="32" y="196" width="536" height="36" rx="4" fill="%231e293b"/>
    <text x="48" y="218" fill="%23cbd5e1" font-family="sans-serif" font-size="12">Técnico / Técnico Upgrade</text>

    <rect x="32" y="238" width="536" height="36" rx="4" fill="%231e293b"/>
    <text x="48" y="260" fill="%23cbd5e1" font-family="sans-serif" font-size="12">Técnico / Cancelado</text>

    <rect x="32" y="280" width="536" height="36" rx="4" fill="%231e293b" stroke="%2338bdf8"/>
    <text x="48" y="302" fill="%2338bdf8" font-family="sans-serif" font-size="12" font-weight="bold">Skills / Skills</text>
  </svg>`
};

export const currentUser: UserProfile = {
  name: 'Meu numero: (você)',
  phone: '+55 44 99123-4567',
  about: 'Mensagens para mim',
  avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=150&q=80'
};

export const initialChats: Chat[] = [
  {
    id: 'c-jullyanna',
    name: 'Jullyanna Índia 💜',
    avatar: 'JÍ',
    avatarType: 'initials',
    avatarBg: '#831843',
    channelName: 'UniFatecie API Oficial',
    assignedAgent: 'SUELI CARDOSO DA SILVA RESENDE',
    createdAtRelative: '6m',
    lastMessageRelative: 'now',
    email: 'jullyanna@unifatecie.edu.br',
    phone: '+55 44 99876-5432',
    identifier: 'ID-10492',
    countryName: 'Brasil',
    city: 'São Paulo',
    company: 'UniFatecie',
    createdAt: '31/07/2026',
    lastActivityAt: '31/07/2026',
    sourceLink: 'https://instagram.com/unifatecie',
    isBlocked: false,
    tags: [{ label: 'comercial_unifatecie', color: '#f59e0b' }],
    lastMessage: 'TEC Enfermagem',
    lastMessageByMe: false,
    time: '15:45',
    unreadCount: 0,
    messages: [
      {
        id: 'm-j1',
        sender: 'them',
        senderName: 'Jullyanna Índia',
        text: 'TEC Enfermagem',
        time: '15:45',
        dateLabel: 'Hoje'
      }
    ]
  },
  {
    id: 'c-eroita',
    name: 'EROITA CUSTÓDIO DA SILVA SOUZA',
    avatar: 'EC',
    avatarType: 'initials',
    avatarBg: '#831843',
    channelName: 'UniFatecie API Oficial',
    assignedAgent: 'MIGUEL GUTIERREZ SEGATELI',
    createdAtRelative: '7m',
    lastMessageRelative: '3m',
    tags: [],
    lastMessage: 'Atendimento VIP para você! 🤗 Agora você ...',
    lastMessageByMe: true,
    time: '15:42',
    messages: [
      {
        id: 'm-e1',
        sender: 'me',
        text: 'Atendimento VIP para você! 🤗 Agora você tem canal exclusivo.',
        time: '15:42',
        dateLabel: 'Hoje'
      }
    ]
  },
  {
    id: 'c-mariana',
    name: 'Mariana Winters',
    avatar: 'MW',
    avatarType: 'initials',
    avatarBg: '#047857',
    channelName: 'UniALFA API Oficial Geral',
    assignedAgent: 'TÁFFINI PADILHA SATURNINO',
    createdAtRelative: '2h',
    lastMessageRelative: '7m',
    tags: [{ label: 'comercial_unifatecie', color: '#f59e0b' }],
    lastMessage: '🎧 Mensagem de áudio',
    lastMessageByMe: true,
    time: '13:38',
    messages: [
      {
        id: 'm-m1',
        sender: 'me',
        text: '🎧 Mensagem de áudio',
        time: '13:38',
        dateLabel: 'Hoje'
      }
    ]
  },
  {
    id: 'c-danielle',
    name: 'Danielle Silva',
    avatar: 'DS',
    avatarType: 'initials',
    avatarBg: '#374151',
    channelName: 'UniFatecie API Oficial',
    assignedAgent: 'ROBERT ALEXANDER HIROMI',
    createdAtRelative: '21d',
    lastMessageRelative: '8m',
    tags: [{ label: 'secretaria_unifatecie', color: '#ef4444' }],
    lastMessage: 'Boa tarde',
    lastMessageByMe: false,
    time: '15:37',
    unreadCount: 2,
    messages: [
      {
        id: 'm-d1',
        sender: 'them',
        senderName: 'Danielle Silva',
        text: 'Boa tarde',
        time: '15:37',
        dateLabel: 'Hoje'
      }
    ]
  },
  {
    id: 'c-lara',
    name: 'Lara Alves De Oliveira - Bacharelado ...',
    avatar: 'LA',
    avatarType: 'initials',
    avatarBg: '#701a75',
    channelName: 'UniFatecie API Oficial',
    assignedAgent: 'MIGUEL GUTIERREZ SEGATELI',
    createdAtRelative: '3h',
    lastMessageRelative: '16m',
    tags: [
      { label: 'comercial_unifatecie', color: '#f59e0b' },
      { label: 'secretaria_unifatecie', color: '#ef4444' }
    ],
    lastMessage: '🔒 Aluna nova enviada para acolhimento.',
    lastMessageByMe: false,
    time: '15:29',
    messages: [
      {
        id: 'm-l1',
        sender: 'them',
        text: 'Aluna nova enviada para acolhimento.',
        time: '15:29',
        isPrivate: true,
        dateLabel: 'Hoje'
      }
    ]
  },
  {
    id: 'c-pedro',
    name: 'Pedro Henrique De Figueiredo',
    avatar: 'PH',
    avatarType: 'initials',
    avatarBg: '#1e3a8a',
    channelName: 'UniALFA API Oficial Geral',
    assignedAgent: 'David Erick Peres Barbosa',
    createdAtRelative: '20h',
    lastMessageRelative: '19m',
    tags: [],
    lastMessage: 'Agradecemos o seu contato. 🤗 Este atendi...',
    lastMessageByMe: true,
    time: '15:26',
    messages: [
      {
        id: 'm-p1',
        sender: 'me',
        text: 'Agradecemos o seu contato. 🤗 Este atendimento foi concluído.',
        time: '15:26',
        dateLabel: 'Hoje'
      }
    ]
  },
  {
    id: 'c-marcelo',
    name: 'Marcelo Da Silva Miranda',
    avatar: 'MD',
    avatarType: 'initials',
    avatarBg: '#9f1239',
    channelName: 'UniALFA API Oficial Geral',
    assignedAgent: 'David Erick Peres Barbosa',
    createdAtRelative: '4h',
    lastMessageRelative: '21m',
    tags: [{ label: 'secretaria_unialfa', color: '#10b981' }],
    lastMessage: 'Positivo. No aguardo',
    lastMessageByMe: true,
    time: '15:24',
    messages: [
      {
        id: 'm-mc1',
        sender: 'me',
        text: 'Positivo. No aguardo',
        time: '15:24',
        dateLabel: 'Hoje'
      }
    ]
  },
  {
    id: 'c-hellen',
    name: 'Hellen',
    avatar: 'H',
    avatarType: 'initials',
    avatarBg: '#831843',
    channelName: 'UniALFA API Oficial Geral',
    assignedAgent: 'TÁFFINI PADILHA SATURNINO',
    createdAtRelative: '2h',
    lastMessageRelative: '29m',
    tags: [{ label: 'comercial_unifatecie', color: '#f59e0b' }],
    lastMessage: 'Vamos concluir sua matricula, ate as 18 aind...',
    lastMessageByMe: true,
    time: '15:16',
    messages: [
      {
        id: 'm-h1',
        sender: 'me',
        text: 'Vamos concluir sua matricula, ate as 18 ainda hoje!',
        time: '15:16',
        dateLabel: 'Hoje'
      }
    ]
  },
  {
    id: 'c-guilherme',
    name: 'Guilherme Policarpo',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    avatarType: 'image',
    channelName: 'UniFatecie API Oficial',
    assignedAgent: 'SUELI CARDOSO DA SILVA RESENDE',
    createdAtRelative: '12d',
    lastMessageRelative: '1h',
    tags: [{ label: 'comercial_unifatecie', color: '#f59e0b' }],
    lastMessage: '🎤 Nota de voz (0:25)',
    lastMessageByMe: false,
    time: '08:40',
    pinned: true,
    unreadCount: 1,
    messages: [
      {
        id: 'm-gp1',
        sender: 'them',
        senderName: 'Guilherme Policarpo',
        time: '08:40',
        dateLabel: 'Hoje',
        attachments: [
          {
            id: 'att-gp-audio',
            type: 'audio',
            url: '',
            title: 'Guilherme Policarpo'
          }
        ],
        audioDuration: '0:25',
        audioAuthor: 'Guilherme Policarpo',
        audioPhone: '+55 44 9937-6314',
        audioAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80'
      }
    ]
  },
  {
    id: 'me',
    name: 'Meu numero: (você)',
    avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=150&q=80',
    avatarType: 'logo',
    channelName: 'Canal Interno',
    assignedAgent: 'Você',
    createdAtRelative: '30d',
    lastMessageRelative: '2h',
    lastMessage: '3 imagens',
    lastMessageByMe: true,
    time: '17:59',
    pinned: true,
    about: 'Mensagens para mim',
    messages: [
      {
        id: 'm1',
        sender: 'me',
        text: 'olà, seja bem vindo',
        time: '16:25',
        status: 'read',
        dateLabel: 'segunda-feira'
      }
    ]
  },
  {
    id: 'c1',
    name: '[GESTÃO - FRUNÊ - KOPLA]',
    avatar: 'X',
    avatarType: 'logo',
    avatarBg: '#2563eb',
    channelName: 'WhatsApp Business',
    assignedAgent: 'Kopla Atendimento',
    createdAtRelative: '5d',
    lastMessageRelative: '3h',
    lastMessage: 'Liberei o acesso!',
    lastMessageByMe: true,
    time: '12:54',
    pinned: true,
    isGroup: true,
    favorite: true,
    messages: [
      {
        id: 'm10',
        sender: 'them',
        senderName: 'Frunê',
        text: 'Preciso da liberação do sistema de gestão.',
        time: '12:45',
        dateLabel: 'Hoje'
      },
      {
        id: 'm11',
        sender: 'me',
        text: 'Liberei o acesso!',
        time: '12:54',
        status: 'read'
      }
    ]
  },
  {
    id: 'c2',
    name: '💻 EQUIPE - MARKETING KOPLA 💻',
    avatar: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=150&q=80',
    avatarType: 'image',
    channelName: 'grupo.kopla',
    assignedAgent: 'Equipe Marketing',
    createdAtRelative: '2d',
    lastMessageRelative: '1d',
    lastMessage: 'excluído',
    lastMessageByMe: true,
    time: 'terça-feira',
    pinned: true,
    isGroup: true,
    favorite: true,
    messages: [
      {
        id: 'm20',
        sender: 'them',
        senderName: 'Design Team',
        text: 'Arte da campanha pronta para revisão.',
        time: '14:20',
        dateLabel: 'terça-feira'
      },
      {
        id: 'm21',
        sender: 'me',
        text: 'excluído',
        time: '14:22',
        status: 'read'
      }
    ]
  },
  {
    id: 'c3',
    name: '[GESTÃO] [MONTINORTE - BOTCOM | KOPLA]',
    avatar: 'X',
    avatarType: 'logo',
    avatarBg: '#2563eb',
    channelName: 'Kopla Sistemas',
    assignedAgent: 'Suporte Montinorte',
    createdAtRelative: '3d',
    lastMessageRelative: '1d',
    lastMessage: 'Ok!',
    lastMessageByMe: true,
    time: '11:25',
    pinned: true,
    isGroup: true,
    favorite: true,
    messages: [
      {
        id: 'm30',
        sender: 'them',
        senderName: 'Suporte Montinorte',
        text: 'Integração Botcom sincronizada.',
        time: '11:20',
        dateLabel: 'Hoje'
      },
      {
        id: 'm31',
        sender: 'me',
        text: 'Ok!',
        time: '11:25',
        status: 'read'
      }
    ]
  },
  {
    id: 'c4',
    name: '[GESTÃO - TIAGO CARVALHO - KOPLA]',
    avatar: '👥',
    avatarType: 'group',
    avatarBg: '#4f46e5',
    channelName: 'Whatsapp Comercial',
    assignedAgent: 'Atendimento Imppar',
    createdAtRelative: '5d',
    lastMessageRelative: '2h',
    lastMessage: 'TIAGO IMPPAR PNEUS: Obrigado',
    lastMessageByMe: false,
    time: '13:53',
    isGroup: true,
    messages: [
      {
        id: 'm40',
        sender: 'them',
        senderName: 'TIAGO IMPPAR PNEUS',
        text: 'Obrigado',
        time: '13:53',
        dateLabel: 'Hoje'
      }
    ]
  },
  {
    id: 'c5',
    name: '✔️ EQUIPE - DEV KOPLA ✔️',
    avatar: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=150&q=80',
    avatarType: 'image',
    channelName: 'Kopla Sistemas',
    assignedAgent: 'Vinicius Prado',
    createdAtRelative: '1w',
    lastMessageRelative: '5h',
    lastMessage: 'Kopla Sistemas: Tentaram bloquear um contato na UMUPRE...',
    lastMessageByMe: true,
    time: '12:39',
    isGroup: true,
    messages: [
      {
        id: 'm50',
        sender: 'them',
        senderName: 'Vinicius Prado Salgado',
        text: '@Vinicius Prado Salgado Segue o link com os 15 posts',
        time: '11:29',
        dateLabel: 'Hoje'
      },
      {
        id: 'm51',
        sender: 'them',
        senderName: 'Vinicius Prado Salgado',
        text: 'https://docs.google.com/document/d/1EufXFSwD093SlyKpWIRQMvcwYxLEb55DAYB-VcIrQOY/edit?usp=sharing',
        time: '11:29',
        dateLabel: 'Hoje',
        linkPreview: {
          domain: 'docs.google.com',
          title: 'docs.google.com',
          url: 'https://docs.google.com/document/d/1EufXFSwD093SlyKpWIRQMvcwYxLEb55DAYB-VcIrQOY/edit?usp=sharing',
          description: 'Documento de Planejamento de Posts e Conteúdos - Kopla Sistemas'
        }
      },
      {
        id: 'm52',
        sender: 'them',
        senderName: 'Allan Silva',
        text: '@Ricardo Freitas o whatsapp de uma funcionaria da umuprev levou um bloqueio, eu falei com o andre porem só para deixar avisado caso venham falar com você, o whatsapp dela esta desconectado desde sexta feira então não da para saber ao certo o motivo de ela ter levado esse bloqueio',
        time: '09:19',
        dateLabel: 'Hoje',
        replyTo: {
          senderName: 'André - Suporte Kopla',
          text: 'Bom dia pessoal, vocês conseguiram checar a data ou horário em que a chave caiu?',
          color: '#00a884'
        },
        attachments: [
          {
            id: 'att-screen',
            type: 'image',
            url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80',
            title: 'Captura de Tela - Conta em Análise'
          }
        ]
      }
    ]
  },
  {
    id: 'c6',
    name: 'Kopla testes',
    avatar: 'KT',
    avatarType: 'initials',
    avatarBg: '#991b1b',
    channelName: 'Whatsapp suporte',
    assignedAgent: 'Suporte Kopla',
    createdAtRelative: '2w',
    lastMessageRelative: '6h',
    lastMessage: 'segue em anexo a documentação com mais detalhes do agente',
    lastMessageByMe: false,
    time: '12:34',
    unreadCount: 1,
    messages: [
      {
        id: 'm60',
        sender: 'them',
        senderName: 'TIAGO IMPPAR PNEUS',
        time: '22:53',
        dateLabel: 'Hoje',
        attachments: [
          {
            id: 'att-audio1',
            type: 'audio',
            url: '',
            title: 'TIAGO IMPPAR PNEUS'
          }
        ],
        audioDuration: '0:19',
        audioAuthor: 'TIAGO IMPPAR PNEUS',
        audioAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
      },
      {
        id: 'm61',
        sender: 'them',
        senderName: 'Kopla testes',
        text: 'Tecnicas-de-Analise-de-Causa-Raiz (2).pdf',
        time: '18:01',
        dateLabel: 'Hoje',
        attachments: [
          {
            id: 'att-doc1',
            type: 'file',
            url: '#',
            title: 'Tecnicas-de-Analise-de-Causa-Raiz (2).pdf',
            subtitle: '9 páginas • PDF • 2 MB',
            pages: '9 páginas',
            size: '2 MB',
            previewUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80'
          }
        ]
      },
      {
        id: 'm62',
        sender: 'them',
        senderName: 'Kopla testes',
        text: 'segue em anexo a documentação com mais detalhes do agente',
        time: '11:20',
        dateLabel: 'Hoje',
        attachments: [
          {
            id: 'att-doc2',
            type: 'file',
            url: '#',
            title: 'documentacao_basica_agente_ia_redusol.pdf',
            subtitle: '3 páginas • PDF • 92 KB',
            pages: '3 páginas',
            size: '92 KB',
            previewUrl: 'https://images.unsplash.com/photo-1568667256549-094345857637?auto=format&fit=crop&w=600&q=80'
          }
        ]
      },
      {
        id: 'm63',
        sender: 'them',
        senderName: 'Kopla testes',
        text: 'O agente inteligente opera realizando a triagem inicial das mensagens recebidas e verificando os pré-requisitos no banco de dados. Caso ocorra qualquer inconsistência nas credenciais do usuário ou se o assunto requerer intervenção humana direta, a conversa é imediatamente sinalizada e transferida para a fila de atendimento interno com prioridade. Somente quando houver necessidade de análise ou ação humana;\nampliar a base de conhecimento e garantir total assertividade nas respostas enviadas aos clientes.',
        time: '11:20',
        dateLabel: 'Hoje'
      }
    ]
  },
  {
    id: 'c-bruno',
    name: 'Bruno Monteiro',
    avatar: 'BM',
    avatarType: 'initials',
    avatarBg: '#059669',
    channelName: 'whatsapp Oficial(7221)',
    assignedAgent: 'Bruno Monteiro',
    createdAtRelative: '1d',
    lastMessageRelative: '3h',
    lastMessage: 'ghp_mqot1Ea7bYIdD5zwkaht9fbtz9rKpW3jik3G',
    lastMessageByMe: false,
    time: '14:18',
    unreadCount: 2,
    favorite: true,
    messages: [
      {
        id: 'mb1',
        sender: 'them',
        senderName: 'Bruno Monteiro',
        text: 'Segue a chave token solicitada para o acesso do repositório.',
        time: '14:17',
        dateLabel: 'Hoje'
      },
      {
        id: 'mb2',
        sender: 'them',
        senderName: 'Bruno Monteiro',
        text: 'ghp_mqot1Ea7bYIdD5zwkaht9fbtz9rKpW3jik3G',
        time: '14:18',
        dateLabel: 'Hoje'
      }
    ]
  },
  {
    id: 'c7',
    name: 'Positive 🔑',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    avatarType: 'image',
    channelName: 'Whatsapp Oficial(9491)',
    assignedAgent: 'Sandra Freitas',
    createdAtRelative: '3d',
    lastMessageRelative: '4h',
    lastMessage: '~Sandra Freitas Oficial: Excelente dia Amadas! O prazer também preci...',
    lastMessageByMe: false,
    time: '11:13',
    messages: [
      {
        id: 'm70',
        sender: 'them',
        senderName: 'Sandra Freitas Oficial',
        text: 'Excelente dia Amadas! O prazer também precisa fazer parte da rotina!',
        time: '11:13',
        dateLabel: 'Hoje'
      }
    ]
  },
  {
    id: 'c8',
    name: 'SofIA CRM PRO - v1.7.1.7-fix1 | CLIENTES 🚀',
    avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=150&q=80',
    avatarType: 'logo',
    avatarBg: '#059669',
    channelName: 'Kopla Sistemas',
    assignedAgent: 'Férlon Piran',
    createdAtRelative: '4d',
    lastMessageRelative: '5h',
    lastMessage: '~Férlon Piran: Ali vc libera isso',
    lastMessageByMe: false,
    time: '10:50',
    muted: true,
    isGroup: true,
    messages: [
      {
        id: 'm80',
        sender: 'them',
        senderName: 'Férlon Piran',
        text: 'Ali vc libera isso',
        time: '10:50',
        dateLabel: 'Hoje'
      }
    ]
  },
  {
    id: 'c9',
    name: 'Lilian Tavares(NetSet)',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80',
    avatarType: 'image',
    channelName: 'grupo.kopla',
    assignedAgent: 'Lilian Tavares',
    createdAtRelative: '1w',
    lastMessageRelative: '6h',
    lastMessage: 'Adicionei as permissões',
    lastMessageByMe: true,
    time: '10:09',
    messages: [
      {
        id: 'm90',
        sender: 'them',
        text: 'Pode verificar as permissões?',
        time: '10:05',
        dateLabel: 'Hoje'
      },
      {
        id: 'm91',
        sender: 'me',
        text: 'Adicionei as permissões',
        time: '10:09',
        status: 'read'
      }
    ]
  },
  {
    id: 'c10',
    name: '+55 44 9981-0086',
    avatar: 'TI',
    avatarType: 'initials',
    avatarBg: '#0284c7',
    channelName: 'Whatsapp comercial',
    assignedAgent: 'Não Atribuído',
    createdAtRelative: '2w',
    lastMessageRelative: '7h',
    lastMessage: 'Entendi. Pelo que vocês relataram, eu particularmente acho muito ...',
    lastMessageByMe: true,
    time: '09:40',
    messages: [
      {
        id: 'm100',
        sender: 'me',
        text: 'Entendi. Pelo que vocês relataram, eu particularmente acho muito mais seguro essa abordagem.',
        time: '09:40',
        status: 'read',
        dateLabel: 'Hoje'
      }
    ]
  },
  {
    id: 'c11',
    name: '+55 45 9930-0934',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80',
    avatarType: 'image',
    channelName: 'Whatsapp suporte',
    assignedAgent: 'Atendimento Comercial',
    createdAtRelative: '3w',
    lastMessageRelative: '8h',
    lastMessage: 'Obrigada',
    lastMessageByMe: false,
    time: '08:57',
    messages: [
      {
        id: 'm110',
        sender: 'them',
        text: 'Obrigada',
        time: '08:57',
        dateLabel: 'Hoje'
      }
    ]
  }
];

export const mockStatuses: StatusItem[] = [
  {
    id: 'st1',
    userName: 'Meu status',
    userAvatar: currentUser.avatar,
    time: 'Adicionar atualização',
    hasUnseen: false,
    stories: []
  },
  {
    id: 'st2',
    userName: 'Equipe Marketing Kopla',
    userAvatar: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=150&q=80',
    time: 'Há 25 minutos',
    hasUnseen: true,
    stories: [
      {
        id: 's1',
        type: 'text',
        content: '🚀 Lançamento da nova versão CRM Kopla hoje às 18h!',
        bgColor: '#005c4b',
        time: '10:30'
      }
    ]
  },
  {
    id: 'st3',
    userName: 'Positive 🔑',
    userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    time: 'Há 1 hora',
    hasUnseen: true,
    stories: [
      {
        id: 's2',
        type: 'image',
        content: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=800&q=80',
        caption: 'Bom dia time! Foco nas metas.',
        time: '09:15'
      }
    ]
  }
];

export const mockCallLogs: CallLog[] = [
  {
    id: 'call1',
    name: 'Lilian Tavares(NetSet)',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80',
    time: 'Hoje, 10:15',
    type: 'outgoing',
    isVideo: false
  },
  {
    id: 'call2',
    name: '+55 44 9981-0086',
    avatar: '',
    time: 'Ontem, 16:40',
    type: 'incoming',
    isVideo: true
  },
  {
    id: 'call3',
    name: 'Kopla testes',
    avatar: '',
    time: '28 de julho, 14:02',
    type: 'missed',
    isVideo: false
  }
];
