import { createFileRoute } from "@tanstack/react-router";
import {
  Wallet, CalendarClock, Activity, ShieldCheck, ShieldAlert, TrendingDown,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/MetricCard";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getUserAccounts, type Account } from "@/lib/api/accounts.functions";
import { getObligations, computeEstado, formatObligationDate, type Obligation } from "@/lib/api/obligations.functions";

export const Route = createFileRoute("/_app/dashboard")({
  loader: async () => {
    const [accounts, obligations] = await Promise.all([getUserAccounts(), getObligations()]);
    return { accounts, obligations };
  },
  component: Dashboard,
});

// 1 USD ≈ 1 500 ARS — tipo de cambio de referencia para el TFG
const USD_TO_ARS = 1500;

function consolidate(accounts: Account[]) {
  let ars = 0;
  let usd = 0;
  for (const acc of accounts) {
    const s = parseFloat(acc.saldo_actual);
    if (acc.moneda === "USD") usd += s;
    else ars += s;
  }
  const totalArs = ars + usd * USD_TO_ARS;
  return { ars, usd, totalArs };
}

function formatArs(n: number): string {
  return `ARS ${Math.abs(n).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function parseArs(s: string): number {
  return parseFloat(s.replace("ARS ", "").replace(/\./g, "").replace(",", ".")) || 0;
}

// ─── Datos de demo para secciones aún no conectadas a BD ─────────────────────

const sparkline = [
  { d: "L", v: 2400 }, { d: "M", v: 2520 }, { d: "X", v: 2480 },
  { d: "J", v: 2680 }, { d: "V", v: 2720 }, { d: "S", v: 2810 }, { d: "D", v: 2847 },
];


// ─── Componente ───────────────────────────────────────────────────────────────

function Dashboard() {
  const { accounts, obligations } = Route.useLoaderData();
  const { ars, usd, totalArs } = consolidate(accounts);

  const saldoLabel = formatArs(totalArs);
  const saldoHint = usd > 0
    ? `${accounts.length} ${accounts.length === 1 ? "cuenta" : "cuentas"} · USD ${usd.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`
    : `${accounts.length} ${accounts.length === 1 ? "cuenta" : "cuentas"}`;

  const hasAccounts = accounts.length > 0;

  const pendientes = obligations.filter((o) => !o.pagado);
  const vencimientosTotal = pendientes.reduce((sum, o) => sum + parseFloat(o.monto), 0);
  const upcoming = pendientes.slice(0, 3);
  const fondosOciosos = totalArs - vencimientosTotal;
  const esSolvente = fondosOciosos >= 0;
  const esExacto = fondosOciosos === 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Saldo Consolidado"
          value={hasAccounts ? saldoLabel : "—"}
          hint={hasAccounts ? saldoHint : "Vinculá una cuenta para empezar"}
          trend={hasAccounts ? undefined : undefined}
          icon={Wallet}
          accent="primary"
        />
        <MetricCard
          label="Próximos Vencimientos"
          value={pendientes.length > 0 ? formatArs(vencimientosTotal) : "—"}
          hint={pendientes.length > 0 ? `${pendientes.length} pendiente${pendientes.length !== 1 ? "s" : ""}` : "Sin obligaciones pendientes"}
          icon={CalendarClock}
          accent="warning"
        />
        <MetricCard
          label={esExacto ? "—" : esSolvente ? "Fondos Ociosos" : "Insolvencia"}
          value={!hasAccounts || esExacto ? "—" : formatArs(fondosOciosos)}
          hint={
            !hasAccounts ? "Vinculá una cuenta para calcular" :
            esExacto ? "Tu saldo cubre exactamente los vencimientos" :
            esSolvente ? "Excedente sobre vencimientos próximos" :
            "Fondos insuficientes para cubrir vencimientos"
          }
          icon={esSolvente ? Activity : TrendingDown}
          accent={esExacto ? "success" : esSolvente ? "success" : "destructive"}
        />
        <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Situación Financiera</span>
            {esSolvente
              ? <ShieldCheck className="h-4 w-4 text-success" />
              : <ShieldAlert className="h-4 w-4 text-destructive" />}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${esSolvente ? "bg-success/60" : "bg-destructive/60"}`} />
              <span className={`relative inline-flex h-3 w-3 rounded-full ${esSolvente ? "bg-success" : "bg-destructive"}`} />
            </span>
            <span className="text-xl font-bold tracking-tight">
              {!hasAccounts ? "—" : esSolvente ? "SALUDABLE" : "INSALUBRE"}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {!hasAccounts ? (
              <>
                <div className="h-1.5 rounded-full bg-muted" />
                <div className="h-1.5 rounded-full bg-muted" />
                <div className="h-1.5 rounded-full bg-muted" />
              </>
            ) : esSolvente ? (
              <>
                <div className="h-1.5 rounded-full bg-success" />
                <div className="h-1.5 rounded-full bg-success" />
                <div className="h-1.5 rounded-full bg-muted" />
              </>
            ) : (
              <>
                <div className="h-1.5 rounded-full bg-destructive" />
                <div className="h-1.5 rounded-full bg-destructive" />
                <div className="h-1.5 rounded-full bg-muted" />
              </>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {!hasAccounts
              ? "Vinculá una cuenta para evaluar"
              : esSolvente
                ? "Tu saldo supera los vencimientos próximos"
                : "Tu saldo no cubre los vencimientos próximos"}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)] xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">Evolución Saldo Consolidado</h3>
              <p className="text-xs text-muted-foreground">Últimos 7 días</p>
            </div>
            <Badge variant="secondary" className="rounded-full">+4.2% sem.</Badge>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <AreaChart data={sparkline} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="oklch(0.55 0.22 255)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="oklch(0.55 0.22 255)" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <XAxis dataKey="d" stroke="oklch(0.55 0.03 255)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.55 0.03 255)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.92 0.01 250)" }} />
                <Area dataKey="v" stroke="oklch(0.55 0.22 255)" strokeWidth={2.5} fill="url(#ga)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)]">
          <h3 className="text-base font-semibold">Próximos Vencimientos</h3>
          <p className="text-xs text-muted-foreground">
            {pendientes.length} pendiente{pendientes.length !== 1 ? "s" : ""}
          </p>
          <div className="mt-4 space-y-3">
            {upcoming.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-4">
                Sin vencimientos registrados
              </p>
            )}
            {upcoming.map((ob) => {
              const estado = computeEstado(ob.fecha_vencimiento, ob.pagado);
              const monto = parseFloat(ob.monto).toLocaleString("es-AR", { minimumFractionDigits: 0 });
              return (
                <div key={ob.id_obligacion} className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3">
                  <div>
                    <div className="text-sm font-semibold">{ob.emisor}</div>
                    <div className="text-xs text-muted-foreground">{formatObligationDate(ob.fecha_vencimiento)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">ARS {monto}</div>
                    <Badge
                      variant={estado === "Urgente" || estado === "Vencido" ? "destructive" : "secondary"}
                      className="mt-0.5 rounded-full text-[10px]"
                    >
                      {estado}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

    </div>
  );
}
