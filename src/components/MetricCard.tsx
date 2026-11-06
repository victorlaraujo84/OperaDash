import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone?: "cyan" | "green" | "amber" | "blue";
  footnote?: string;
}

export function MetricCard({ label, value, detail, icon, tone = "cyan", footnote }: MetricCardProps) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <div className="metric-card__top">
        <span className="metric-card__label">{label}</span>
        <span className="metric-card__icon" aria-hidden="true">{icon}</span>
      </div>
      <div className="metric-card__value">{value}</div>
      <p className="metric-card__detail">{detail}</p>
      {footnote ? <p className="metric-card__footnote">{footnote}</p> : null}
    </article>
  );
}
