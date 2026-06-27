import { type LucideIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  trendDir = "up",
  accent = "primary",
  cta,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  trend?: string;
  trendDir?: "up" | "down";
  accent?: "primary" | "success" | "warning" | "destructive";
  cta?: { label: string; href: string };
}) {
  const accentMap = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning",
    destructive: "bg-destructive/10 text-destructive",
  };
  return (
    <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        {Icon && (
          <div className={`grid h-9 w-9 place-items-center rounded-xl ${accentMap[accent]}`}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">{value}</div>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {trend && (
          <span className={trendDir === "up" ? "text-success" : "text-destructive"}>
            {trendDir === "up" ? "▲" : "▼"} {trend}
          </span>
        )}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
      {cta && (
        <Link
          to={cta.href}
          className="mt-3 inline-block rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          {cta.label}
        </Link>
      )}
    </Card>
  );
}
