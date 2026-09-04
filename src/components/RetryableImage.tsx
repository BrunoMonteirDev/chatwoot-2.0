import React, { useEffect, useRef, useState } from 'react';

type State = 'loading' | 'loaded' | 'retrying' | 'error';
type Props = { src: string; fallbackSrc?: string; alt: string; width?: number; height?: number; className?: string; onClick?: () => void };

export const RetryableImage: React.FC<Props> = ({ src, fallbackSrc, alt, width, height, className = '', onClick }) => {
  const sources = [fallbackSrc, src].filter((value): value is string => Boolean(value));
  const [state, setState] = useState<State>('loading');
  const [sourceIndex, setSourceIndex] = useState(0);
  const [revision, setRevision] = useState(0);
  const retryRef = useRef<number | null>(null);
  useEffect(() => { setState('loading'); setSourceIndex(0); setRevision(0); return () => { if (retryRef.current) window.clearTimeout(retryRef.current); }; }, [src, fallbackSrc]);
  const retry = (automatic = false) => {
    if (automatic && revision >= 1) { setState('error'); return; }
    setState('retrying');
    retryRef.current = window.setTimeout(() => { setRevision((value) => value + 1); setState('loading'); }, automatic ? 300 : 0);
  };
  const aspectRatio = width && height ? `${width} / ${height}` : '4 / 3';
  const currentSrc = sources[sourceIndex] || src;
  return <div className="relative w-full overflow-hidden bg-[#202c33]/30" style={{ aspectRatio }} onClick={onClick}>
    {state !== 'loaded' && <div aria-label="Carregando imagem" className="absolute inset-0 animate-pulse bg-[#8696a0]/15" />}
    <img key={`${currentSrc}:${revision}`} src={currentSrc} alt={alt} width={width} height={height} loading="lazy" className={className} referrerPolicy="no-referrer"
      onLoad={() => setState('loaded')}
      onError={() => { if (sourceIndex + 1 < sources.length) { setSourceIndex((value) => value + 1); setState('loading'); } else retry(true); }} />
    {state === 'error' && <button type="button" onClick={(event) => { event.stopPropagation(); retry(); }} className="absolute inset-0 m-auto h-fit w-fit rounded bg-black/70 px-3 py-2 text-xs font-semibold text-white">Tentar novamente</button>}
  </div>;
};
