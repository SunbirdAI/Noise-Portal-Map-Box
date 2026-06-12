import type { ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface StatusPanelProps {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
}

export default function StatusPanel({ title, body, actionLabel, onAction, icon }: StatusPanelProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          {icon ?? <AlertTriangle size={20} aria-hidden="true" />}
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold text-slate-950">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{body}</p>
          {actionLabel && onAction ? (
            <button
              type="button"
              onClick={onAction}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              <RefreshCw size={16} aria-hidden="true" />
              {actionLabel}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
