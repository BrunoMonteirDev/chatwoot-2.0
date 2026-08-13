import React from 'react';

export const InstagramIcon: React.FC<{ className?: string }> = ({
  className = 'w-3.5 h-3.5 shrink-0 text-pink-500 fill-none stroke-current stroke-2',
}) => (
  <svg viewBox="0 0 24 24" className={className}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

export const MessengerIcon: React.FC<{ className?: string }> = ({
  className = 'w-3.5 h-3.5 shrink-0 text-blue-500 fill-current',
}) => (
  <svg viewBox="0 0 24 24" className={className}>
    <path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.91 1.455 5.51 3.733 7.182V22l3.435-1.888a10.82 10.82 0 0 0 2.832.373c5.523 0 10-4.145 10-9.258C22 6.145 17.523 2 12 2zm1.066 12.288l-2.583-2.757-5.04 2.757 5.544-5.888 2.646 2.757 4.977-2.757-5.544 5.888z" />
  </svg>
);

export const WhatsappIcon: React.FC<{ className?: string }> = ({
  className = 'w-3.5 h-3.5 shrink-0 text-emerald-500 fill-current',
}) => (
  <svg viewBox="0 0 24 24" className={className}>
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l.399.638-1.151 4.201 4.302-1.128.593.356z" />
  </svg>
);

export const WhatsappOficialIcon: React.FC<{ className?: string }> = ({
  className = 'w-3.5 h-3.5 shrink-0',
}) => (
  <span
    className="relative inline-flex items-center justify-center shrink-0"
    title="WhatsApp API Oficial (Verificado)"
  >
    <svg viewBox="0 0 24 24" className={`${className} text-emerald-500 fill-current`}>
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l.399.638-1.151 4.201 4.302-1.128.593.356z" />
    </svg>
    {/* Blue Verified Checkmark Badge */}
    <span className="absolute -bottom-0.5 -right-0.5 flex h-2 w-2 items-center justify-center rounded-full bg-blue-500 text-white ring-1 ring-white dark:ring-[#111b21]">
      <svg className="w-1 h-1 fill-none stroke-current stroke-[3.5]" viewBox="0 0 24 24">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  </span>
);

export const getChannelIcon = (channelName?: string) => {
  if (!channelName) return null;
  const norm = channelName.toLowerCase();
  if (norm.includes('oficial') || norm.includes('api')) {
    return <WhatsappOficialIcon />;
  }
  if (norm.includes('whatsapp') || norm.includes('wa')) {
    return <WhatsappIcon />;
  }
  if (norm.includes('grupo.kopla') || norm.includes('instagram')) {
    return <InstagramIcon />;
  }
  if (norm.includes('sistemas') || norm.includes('messenger')) {
    return <MessengerIcon />;
  }
  return <WhatsappIcon />;
};
