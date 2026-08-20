import { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';

type Props = {
  title: string;
  description: string;
  confirmLabel?: string;
  isBusy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export const ConfirmDialog = ({
  title,
  description,
  confirmLabel = 'Excluir',
  isBusy = false,
  onCancel,
  onConfirm,
}: Props) => {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isBusy) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isBusy, onCancel]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isBusy) onCancel(); }}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description" className="w-full max-w-md rounded-2xl border border-[#2a3942] bg-[#111b21] p-5 text-[#e9edef] shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-500/15 text-red-400"><AlertTriangle className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-dialog-title" className="text-base font-semibold">{title}</h2>
            <p id="confirm-dialog-description" className="mt-1 text-sm leading-5 text-[#aebac1]">{description}</p>
          </div>
          <button type="button" onClick={onCancel} disabled={isBusy} aria-label="Fechar" className="rounded-full p-1 text-[#aebac1] transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button ref={cancelRef} type="button" onClick={onCancel} disabled={isBusy} className="rounded-lg px-4 py-2 text-sm font-semibold text-[#aebac1] transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40">Cancelar</button>
          <button type="button" onClick={onConfirm} disabled={isBusy} className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50">{isBusy ? 'Excluindo…' : confirmLabel}</button>
        </div>
      </section>
    </div>
  );
};
