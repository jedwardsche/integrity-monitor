interface MetricCardProps {
  label: string;
  value: string | number;
  badge?: string;
  context?: string;
  delta?: string;
}

export function MetricCard({ label, value, badge, context, delta }: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-mid)]/70 p-4">
      <p className="text-sm text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 text-3xl font-semibold" style={{ fontFamily: "Outfit" }}>
        {value}
      </p>
      {badge && <p className="text-sm text-[var(--brand)] font-medium">{badge}</p>}
      {delta && <p className="text-xs text-[var(--text-muted)] mt-1">{delta}</p>}
      {context && <p className="mt-1 text-sm text-[var(--text-muted)]">{context}</p>}
    </div>
  );
}

