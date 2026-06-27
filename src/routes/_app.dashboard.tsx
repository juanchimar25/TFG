import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Wallet, Activity, ShieldCheck, ShieldAlert, TrendingDown,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/MetricCard";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
  return `ARS ${Math.abs(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseArs(s: string): number {
  return parseFloat(s.replace("ARS ", "").replace(/\./g, "").replace(",", ".")) || 0;
}

// ─── Liquidez ─────────────────────────────────────────────────────────────────

const MONTHS_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

type LiqDay = { day: number; verde: number | null; roja: number | null; azul: number | null };

function buildLiquidityData(totalArs: number, obligations: Obligation[]): LiqDay[] {
  const today       = new Date();
  const year        = today.getFullYear();
  const month       = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayDate   = today.getDate();

  // Egresos ya realizados (pagadas con fecha_pago en el mes)
  const paidByDay = new Array(daysInMonth + 1).fill(0) as number[];
  // Obligaciones vencidas o con vencimiento hoy → se restan a partir de hoy
  let totalVencidas = 0;
  // Obligaciones pendientes con vencimiento futuro dentro del mes
  const upcomingByDay = new Array(daysInMonth + 1).fill(0) as number[];

  for (const obl of obligations) {
    const monto = parseFloat(obl.monto);
    if (obl.pagado && obl.fecha_pago) {
      const d = new Date(obl.fecha_pago + "T12:00:00");
      if (d.getFullYear() === year && d.getMonth() === month)
        paidByDay[d.getDate()] += monto;
    } else if (!obl.pagado) {
      const d   = new Date(obl.fecha_vencimiento + "T12:00:00");
      const dy  = d.getFullYear();
      const dm  = d.getMonth();
      const dd  = d.getDate();
      // Vencida: mes/año anterior, o mismo mes con fecha <= hoy → impacta hoy
      const isVencida = dy < year || (dy === year && dm < month) ||
                        (dy === year && dm === month && dd <= todayDate);
      // Próxima: mismo mes, fecha posterior a hoy
      const isProxima = dy === year && dm === month && dd > todayDate;
      if (isVencida)       totalVencidas       += monto;
      else if (isProxima)  upcomingByDay[dd]   += monto;
    }
  }

  // Sumas de prefijo
  const paidPfx     = new Array(daysInMonth + 1).fill(0) as number[];
  const upcomingPfx = new Array(daysInMonth + 1).fill(0) as number[];
  for (let d = 1; d <= daysInMonth; d++) {
    paidPfx[d]     = paidPfx[d - 1]     + paidByDay[d];
    upcomingPfx[d] = upcomingPfx[d - 1] + upcomingByDay[d];
  }

  // Liquidez en día d:
  //   d < hoy  → totalArs + pagos realizados DESPUÉS de d (hasta hoy)
  //   d ≥ hoy  → totalArs − vencidas − próximas acumuladas desde mañana hasta d
  const raw: { day: number; liq: number }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    let liq = totalArs;
    if (d < todayDate) {
      liq += paidPfx[todayDate] - paidPfx[d];
    } else {
      liq -= totalVencidas;
      if (d > todayDate) liq -= upcomingPfx[d] - upcomingPfx[todayDate];
    }
    raw.push({ day: d, liq });
  }

  // Punto de cruce fraccionario: verde y roja se tocan en y=0 con exactitud
  // azul: null en el cruce para que no aparezca ningún punto visible
  const data: LiqDay[] = [];
  for (let i = 0; i < raw.length; i++) {
    const { day, liq } = raw[i];
    const prev = i > 0 ? raw[i - 1] : null;
    if (prev !== null && ((prev.liq > 0 && liq < 0) || (prev.liq < 0 && liq > 0))) {
      const ratio    = Math.abs(prev.liq) / (Math.abs(prev.liq) + Math.abs(liq));
      const crossDay = prev.day + ratio;
      data.push({ day: crossDay, verde: 0, roja: 0, azul: null });
    }
    data.push({
      day,
      verde: liq > 0   ? liq : liq === 0 ? 0 : null,
      roja:  liq < 0   ? liq : liq === 0 ? 0 : null,
      azul:  liq === 0 ? 0   : null,
    });
  }
  return data;
}


// ─── Componente ───────────────────────────────────────────────────────────────

function Dashboard() {
  const { accounts, obligations } = Route.useLoaderData();
  const { ars, usd, totalArs } = consolidate(accounts);

  const saldoLabel = formatArs(totalArs);
  const saldoHint = usd > 0
    ? `${accounts.length} ${accounts.length === 1 ? "cuenta" : "cuentas"} · USD ${usd.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`
    : `${accounts.length} ${accounts.length === 1 ? "cuenta" : "cuentas"}`;

  const hasAccounts = accounts.length > 0;

  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const today         = new Date();

  const mesActual     = `${MONTHS_ES[today.getMonth()]} ${today.getFullYear()}`;
  const liquidityData = buildLiquidityData(totalArs, obligations);
  const todayLiq      = liquidityData.find(d => d.day === today.getDate());
  const liqHoy        = todayLiq?.verde ?? todayLiq?.roja ?? 0;
  const liqPositiva   = liqHoy >= 0;

  const pendientes = obligations.filter((o) => !o.pagado);
  const vencimientosTotal = pendientes.reduce((sum, o) => sum + parseFloat(o.monto), 0);
  const upcoming = pendientes.slice(0, 3);

  // Día activo: el seleccionado o hoy por defecto
  const activeDay     = selectedDay ?? today.getDate();
  const activeLiqPt   = liquidityData.find(d => d.day === activeDay);
  const activeLiq     = activeLiqPt?.verde ?? activeLiqPt?.roja ?? 0;
  const esSolvente    = activeLiq >= 0;
  const esExacto      = activeLiq === 0;
  const fondosOciosos = activeLiq;

  // Sincronizar montos con sessionStorage para que investments/loans los lean
  if (typeof window !== "undefined") {
    sessionStorage.setItem("primus_fondos_ociosos", String(Math.max(0, Math.round(activeLiq))));
    sessionStorage.setItem("primus_insolvencia",    String(Math.max(0, Math.round(-activeLiq))));
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Saldo Consolidado"
          value={hasAccounts ? saldoLabel : "—"}
          hint={hasAccounts ? saldoHint : "Vinculá una cuenta para empezar"}
          trend={hasAccounts ? undefined : undefined}
          icon={Wallet}
          accent="primary"
        />
        <MetricCard
          label={esExacto ? "—" : esSolvente ? "Fondos Ociosos" : "Insolvencia"}
          value={!hasAccounts || esExacto ? "—" : formatArs(Math.abs(fondosOciosos))}
          hint={
            !hasAccounts ? "Vinculá una cuenta para calcular" :
            esExacto ? `Día ${activeDay} · Saldo exacto` :
            esSolvente ? `Día ${activeDay} · Excedente sobre obligaciones pendientes` :
            `Día ${activeDay} · Fondos insuficientes para cubrir obligaciones pendientes`
          }
          icon={esSolvente ? Activity : TrendingDown}
          accent={esExacto ? "success" : esSolvente ? "success" : "destructive"}
          cta={hasAccounts && !esExacto
            ? esSolvente
              ? { label: "Ver opciones de inversión →", href: "/investments" }
              : { label: "Ver opciones de financiación →", href: "/loans" }
            : undefined}
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
                ? "Tu saldo supera tus obligaciones pendientes"
                : "Tu saldo no cubre las obligaciones pendientes"}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)] xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">Evolución de Saldo Consolidado</h3>
              <p className="text-xs text-muted-foreground">{mesActual}</p>
            </div>
            <Badge
              variant={liqPositiva ? "secondary" : "destructive"}
              className="rounded-full"
            >
              {hasAccounts
                ? `${liqPositiva ? "+" : "−"}${formatArs(Math.abs(liqHoy))}`
                : "Sin cuentas"}
            </Badge>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <AreaChart
                data={liquidityData}
                margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
                style={{ cursor: "pointer" }}
                onClick={(state: { activePayload?: { payload?: { day?: number } }[] }) => {
                  const day = state.activePayload?.[0]?.payload?.day;
                  if (day != null && Number.isInteger(day))
                    setSelectedDay(prev => prev === day ? null : day);
                }}
              >
                <XAxis
                  dataKey="day"
                  stroke="oklch(0.55 0.03 255)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => (v === 1 || (Number.isInteger(v) && v % 5 === 0)) ? String(v) : ""}
                />
                <YAxis
                  stroke="oklch(0.55 0.03 255)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) =>
                    Math.abs(v) >= 1_000_000
                      ? `${(v / 1_000_000).toFixed(1)}M`
                      : `${(v / 1_000).toFixed(0)}k`
                  }
                />
                <Tooltip
                  cursor={false}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length || !Number.isInteger(Number(label))) return null;
                    // En días de transición hay anclas en 0 → tomamos el valor de mayor magnitud
                    const val = (payload as { value?: number | null }[]).reduce<number | undefined>((best, p) => {
                      const v = p.value;
                      if (v == null) return best;
                      if (best === undefined) return v;
                      return Math.abs(v) > Math.abs(best) ? v : best;
                    }, undefined);
                    return (
                      <div style={{ borderRadius: 12, border: "1px solid oklch(0.92 0.01 250)" }} className="bg-background p-2.5 text-xs shadow-md">
                        <p className="mb-1 font-medium text-foreground">Día {label}</p>
                        {val !== undefined && <p className="text-muted-foreground">Saldo: {formatArs(val)}</p>}
                      </div>
                    );
                  }}
                />
                <ReferenceLine y={0} stroke="oklch(0.75 0.03 255)" strokeDasharray="4 4" />
                <ReferenceLine x={today.getDate()} stroke="oklch(0.5 0.03 255)" strokeWidth={2} strokeDasharray="4 4" isFront />
                {selectedDay !== null && selectedDay !== today.getDate() && (
                  <ReferenceLine x={selectedDay} stroke="oklch(0.4 0.15 255)" strokeWidth={2} isFront />
                )}
                <Area dataKey="verde" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false} baseValue={0} />
                <Area dataKey="roja"  stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false} baseValue={0} />
                <Area dataKey="azul"  stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2.5} dot={{ r: 4, fill: "#3b82f6" }} connectNulls={false} isAnimationActive={false} baseValue={0} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold">Obligaciones Pendientes</h3>
              <p className="text-xs text-muted-foreground">
                {pendientes.length} pendiente{pendientes.length !== 1 ? "s" : ""}
              </p>
            </div>
            {pendientes.length > 0 && (
              <span className="pr-3 text-xl font-semibold">{formatArs(vencimientosTotal)}</span>
            )}
          </div>
          <div className="mt-4 space-y-3">
            {upcoming.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-4">
                Sin vencimientos registrados
              </p>
            )}
            {upcoming.map((ob) => {
              const estado = computeEstado(ob.fecha_vencimiento, ob.pagado);
              const monto = parseFloat(ob.monto).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
