import clsx from 'clsx';

interface BadgeProps {
  children: string;
  tone?: 'neutral' | 'green' | 'amber' | 'red' | 'blue';
}

const tones = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  green: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-100 text-amber-800 ring-amber-200',
  red: 'bg-rose-100 text-rose-700 ring-rose-200',
  blue: 'bg-sky-100 text-sky-700 ring-sky-200',
};

export default function Badge({ children, tone = 'neutral' }: BadgeProps) {
  return (
    <span className={clsx('inline-flex items-center rounded-md px-2 py-1 text-xs font-bold ring-1 ring-inset', tones[tone])}>
      {children}
    </span>
  );
}
