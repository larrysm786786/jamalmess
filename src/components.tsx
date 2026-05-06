import type { ReactNode } from "react";

export function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-bold text-slate-900 dark:text-white">{title}</h2>
      <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
    </div>
  );
}

export function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card p-2.5">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1.5 text-xl font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-semibold text-slate-900 dark:text-white">{value}</span>
    </div>
  );
}

export function RecordCard({
  title,
  subtitle,
  amount,
  onEdit,
  onDelete
}: {
  title: string;
  subtitle: string;
  amount?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-none border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950/70">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
        <div className="text-right">
          {amount ? <p className="text-sm font-bold text-slate-900 dark:text-white">{amount}</p> : null}
          <div className="mt-1 flex justify-end gap-2">
            <button onClick={onEdit} className="text-xs font-semibold text-brand-700 dark:text-brand-300">
              Edit
            </button>
            <button onClick={onDelete} className="text-xs font-semibold text-rose-600 dark:text-rose-300">
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-none border border-dashed border-slate-300 p-3 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
      {text}
    </div>
  );
}

export function InfoBox({
  children,
  tone = "amber"
}: {
  children: ReactNode;
  tone?: "amber" | "green";
}) {
  const toneClass =
    tone === "green"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
      : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100";

  return <div className={`rounded-none border p-2 text-xs leading-5 ${toneClass}`}>{children}</div>;
}
