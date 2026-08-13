import React from 'react';

export type WallpaperId =
  | 'dark-doodle'
  | 'dark-green-doodle'
  | 'light-beige-doodle'
  | 'mint-doodle'
  | 'salmon-doodle'
  | 'solid-dark'
  | 'solid-light';

interface Props {
  wallpaperId?: WallpaperId;
  isDarkMode?: boolean;
  className?: string;
}

export const WALLPAPER_PRESETS: {
  id: WallpaperId;
  name: string;
  bgColor: string;
  strokeColor: string;
  opacity: number;
  previewBg: string;
}[] = [
  {
    id: 'dark-doodle',
    name: 'Escuro Clássico (Doodle)',
    bgColor: '#0e0c0c',
    strokeColor: '#ffffff',
    opacity: 0.07,
    previewBg: 'bg-[#0e0c0c]',
  },
  {
    id: 'dark-green-doodle',
    name: 'Verde Escuro (Doodle)',
    bgColor: '#0d201c',
    strokeColor: '#25d366',
    opacity: 0.08,
    previewBg: 'bg-[#0d201c]',
  },
  {
    id: 'light-beige-doodle',
    name: 'Bege Claro (Doodle)',
    bgColor: '#efeae2',
    strokeColor: '#111b21',
    opacity: 0.08,
    previewBg: 'bg-[#efeae2]',
  },
  {
    id: 'mint-doodle',
    name: 'Verde Menta (Doodle)',
    bgColor: '#8dc3b0',
    strokeColor: '#075e54',
    opacity: 0.1,
    previewBg: 'bg-[#8dc3b0]',
  },
  {
    id: 'salmon-doodle',
    name: 'Salmão Coral (Doodle)',
    bgColor: '#f07167',
    strokeColor: '#ffffff',
    opacity: 0.12,
    previewBg: 'bg-[#f07167]',
  },
  {
    id: 'solid-dark',
    name: 'Sólido Escuro',
    bgColor: '#0e0c0c',
    strokeColor: 'transparent',
    opacity: 0,
    previewBg: 'bg-[#0e0c0c]',
  },
  {
    id: 'solid-light',
    name: 'Sólido Claro',
    bgColor: '#e5ddd5',
    strokeColor: 'transparent',
    opacity: 0,
    previewBg: 'bg-[#e5ddd5]',
  },
];

export const WhatsAppDoodleBg: React.FC<Props> = ({
  wallpaperId,
  isDarkMode = false,
  className = '',
}) => {
  // Determine effective wallpaper preset
  const selectedId =
    wallpaperId || (isDarkMode ? 'dark-doodle' : 'light-beige-doodle');
  const preset =
    WALLPAPER_PRESETS.find((p) => p.id === selectedId) || WALLPAPER_PRESETS[0];

  return (
    <div
      className={`absolute inset-0 pointer-events-none select-none ${className}`}
      style={{ backgroundColor: preset.bgColor }}
    >
      {preset.opacity > 0 && (
        <svg
          className="w-full h-full"
          style={{ opacity: preset.opacity }}
          xmlns="http://www.w3.org/2000/svg"
          width="100%"
          height="100%"
        >
          <defs>
            <pattern
              id={`wa-doodle-pattern-${preset.id}`}
              x="0"
              y="0"
              width="140"
              height="140"
              patternUnits="userSpaceOnUse"
            >
              {/* Phone / Mobile */}
              <path
                d="M12 12 h14 v24 h-14 z M16 16 h6 v14 h-6 z M19 32 a1 1 0 1 0 0.1 0"
                fill="none"
                stroke={preset.strokeColor}
                strokeWidth="1.2"
              />
              {/* Chat Bubble */}
              <path
                d="M48 18 a10 10 0 0 1 14 0 a10 10 0 0 1 -5 12 l-5 5 v-5 a10 10 0 0 1 -4 -12"
                fill="none"
                stroke={preset.strokeColor}
                strokeWidth="1.2"
              />
              {/* Camera */}
              <path
                d="M92 18 h20 v14 h-20 z M97 14 h10 v4 h-10 z M102 25 a4 4 0 1 0 0.1 0"
                fill="none"
                stroke={preset.strokeColor}
                strokeWidth="1.2"
              />
              {/* Heart */}
              <path
                d="M24 72 a5 5 0 0 1 8 -3 a5 5 0 0 1 8 3 a5 5 0 0 1 -8 8 z"
                fill="none"
                stroke={preset.strokeColor}
                strokeWidth="1.2"
              />
              {/* Key */}
              <path
                d="M72 72 a5 5 0 1 0 -5 5 h14 v-3 h-3 v-3 h-3 z"
                fill="none"
                stroke={preset.strokeColor}
                strokeWidth="1.2"
              />
              {/* Clock */}
              <path
                d="M118 72 a10 10 0 1 0 0.1 0 M118 66 v6 h4"
                fill="none"
                stroke={preset.strokeColor}
                strokeWidth="1.2"
              />
              {/* Star */}
              <path
                d="M48 116 l3 6 l6 1 l-4 4 l1 6 l-6 -3 l-6 3 l1 -6 l-4 -4 l6 -1 z"
                fill="none"
                stroke={preset.strokeColor}
                strokeWidth="1.2"
              />
              {/* Microphone */}
              <path
                d="M96 116 a4 4 0 0 0 8 0 v-5 a4 4 0 0 0 -8 0 z M93 116 a7 7 0 0 0 14 0 M100 123 v4"
                fill="none"
                stroke={preset.strokeColor}
                strokeWidth="1.2"
              />
              {/* Music Note */}
              <path
                d="M16 112 v16 m0 -12 l10 -3 v12 M26 113 a3 3 0 1 1 -3 -3 M16 125 a3 3 0 1 1 -3 -3"
                fill="none"
                stroke={preset.strokeColor}
                strokeWidth="1.2"
              />
            </pattern>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill={`url(#wa-doodle-pattern-${preset.id})`}
          />
        </svg>
      )}
    </div>
  );
};

