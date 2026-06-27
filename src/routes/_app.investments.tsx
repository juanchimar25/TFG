import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TrendingUp, Sparkles, Trophy, Info,
} from "lucide-react";

// ─── Logo helpers ─────────────────────────────────────────────────────────────

// Logos locales en /public/logos/ — tienen prioridad sobre Google Favicon
const LOCAL_LOGOS: Record<string, string> = {
  "Ualá":                       "/logos/uala.png",
  "Banco Bica (hasta $750K)":   "/logos/bica.png",
  "Banco Bica ($750K–$2.25M)":  "/logos/bica.png",
  "Banco Bica ($2.25M–$20M)":   "/logos/bica.png",
  "Banco Bica (> $20M)":        "/logos/bica.png",
  "Banco Supervielle":          "/logos/supervielle.png",
  "Supervielle Hit IOL":        "/logos/supervielle.png",
  "Cresium":                    "/logos/cresium.png",
};

// Logos via Google Favicon para el resto
const CR_LOGO_DOMAINS: Record<string, string> = {
  "Naranja X":                  "naranjax.com",
  "Ualá":                       "uala.com.ar",
  "Ualá Plus":                  "uala.com.ar",
  "Ualá Plus (max)":            "uala.com.ar",
  "Brubank":                    "brubank.com.ar",
  "Fiwind":                     "fiwind.io",
  "Carrefour Banco":            "carrefour.com.ar",
  "Banco Nación":               "bna.com.ar",
  "Belo":                       "belo.app",
  "Montemar Pay":               "montemarpay.com.ar",
};

function crLogoUrl(nombre: string): string | null {
  if (LOCAL_LOGOS[nombre]) return LOCAL_LOGOS[nombre];
  const d = CR_LOGO_DOMAINS[nombre];
  return d ? `https://www.google.com/s2/favicons?domain=${d}&sz=64` : null;
}

// Logos para PF sin URL del BCRA — local primero, Google Favicon como fallback
const PF_LOGO_OVERRIDES: Record<string, string> = {
  "Ualá":    "/logos/uala.png",
  "Brubank": "https://www.google.com/s2/favicons?domain=brubank.com.ar&sz=64",
};

// Genera un color HSL determinístico a partir del nombre
function nameColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h},55%,42%)`;
}

function EntityLogo({ src, name }: { src: string | null; name: string }) {
  const [err, setErr] = useState(false);
  const letter = name.replace(/^Banco /, "").charAt(0).toUpperCase();

  if (!src || err) {
    return (
      <div
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold text-white"
        style={{ backgroundColor: nameColor(name) }}
      >
        {letter}
      </div>
    );
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white">
      <img
        src={src}
        alt=""
        className="h-7 w-7 object-contain"
        onError={() => setErr(true)}
      />
    </div>
  );
}
import {
  getPlazofijo, getCuentasRemuneradas,
  type PlazofijRate, type CuentaRemunRate,
} from "@/lib/api/rates.functions";
import { getUserAccounts } from "@/lib/api/accounts.functions";
import { getObligations } from "@/lib/api/obligations.functions";

const USD_TO_ARS = 1500;

export const Route = createFileRoute("/_app/investments")({
  loader: async () => {
    const [plazofijo, remuneradas, accounts, obligations] = await Promise.all([
      getPlazofijo(),
      getCuentasRemuneradas(),
      getUserAccounts(),
      getObligations(),
    ]);
    const totalArs = accounts.reduce((s, a) => s + parseFloat(a.saldo_actual) * (a.moneda === "USD" ? USD_TO_ARS : 1), 0);
    const today = new Date();
    const totalVencidas = obligations
      .filter(o => !o.pagado)
      .filter(o => new Date(o.fecha_vencimiento + "T12:00:00") <= today)
      .reduce((s, o) => s + parseFloat(o.monto), 0);
    const fondosOciosos = Math.max(0, Math.round(totalArs - totalVencidas));
    return { plazofijo, remuneradas, defaultAmount: fondosOciosos };
  },
  component: Investments,
});

// Plazo fijo — interés simple (estándar argentino)
function gainPf(amount: number, tna: number, days: number): number {
  return Math.round(amount * (tna / 100) * (days / 365));
}

// Cuenta remunerada — capitalización diaria sobre TEA
function gainCr(amount: number, tea: number, days: number): number {
  return Math.round(amount * (Math.pow(1 + tea / 100, days / 365) - 1));
}

const PLAZOS = [30, 60, 90, 180, 365];

function Investments() {
  const { plazofijo, remuneradas, defaultAmount } = Route.useLoaderData();
  const [tab, setTab]                       = useState<"pf" | "cr">("pf");
  const [amount, setAmount]                 = useState(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("primus_fondos_ociosos");
      if (stored !== null) return Number(stored);
    }

    return defaultAmount;
  });
  const [inputStr, setInputStr]             = useState(() => amount.toLocaleString("es-AR", { maximumFractionDigits: 0 }));
  const amountRef                           = useRef<HTMLInputElement>(null);
  const [days, setDays]                     = useState(30);
  const [showNoClientes, setShowNoClientes] = useState(false);
  const [selectedPfIdx, setSelectedPfIdx]   = useState(0);
  const [selectedCrIdx, setSelectedCrIdx]   = useState(0);

  const pfSorted = [...plazofijo].sort((a, b) =>
    showNoClientes ? b.tnaNoClientes - a.tnaNoClientes : b.tnaClientes - a.tnaClientes,
  );
  const crSorted = [...remuneradas];

  // Al cambiar el toggle clientes/no-clientes, resetear selección al primero
  const handleToggleClientes = (noClientes: boolean) => {
    setShowNoClientes(noClientes);
    setSelectedPfIdx(0);
  };

  // Al cambiar de tab, resetear selección
  const handleTabChange = (t: "pf" | "cr") => {
    setTab(t);
    setSelectedPfIdx(0);
    setSelectedCrIdx(0);
  };

  const selPf = pfSorted[selectedPfIdx] as PlazofijRate | undefined;
  const selCr = crSorted[selectedCrIdx] as CuentaRemunRate | undefined;

  return (
    <div className="space-y-6">

      {/* Simulador */}
      <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold">Simulador</h3>
            <p className="text-xs text-muted-foreground">
              Seleccioná una opción del ranking para simular el rendimiento.
            </p>
          </div>
        </div>
        <div className="mt-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-2 md:items-end">
            <div>
              <Label htmlFor="amount">Monto a colocar (ARS)</Label>
              <Input
                ref={amountRef}
                id="amount"
                type="text"
                inputMode="numeric"
                value={inputStr}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const pos = e.target.selectionStart ?? e.target.value.length;
                  const digitsAntes = e.target.value.slice(0, pos).replace(/\D/g, "").length;
                  const raw = e.target.value.replace(/\D/g, "");
                  if (!raw) { setInputStr(""); setAmount(0); return; }
                  const num = Number(raw);
                  const fmt = num.toLocaleString("es-AR", { maximumFractionDigits: 0 });
                  setInputStr(fmt);
                  setAmount(num);
                  requestAnimationFrame(() => {
                    const el = amountRef.current;
                    if (!el) return;
                    let count = 0; let newPos = fmt.length;
                    for (let i = 0; i < fmt.length; i++) {
                      if (/\d/.test(fmt[i]) && ++count === digitsAntes) { newPos = i + 1; break; }
                    }
                    el.setSelectionRange(newPos, newPos);
                  });
                }}
                className="mt-1.5 h-12 rounded-xl text-lg font-semibold"
              />
            </div>
            <div>
              <Label>Plazo</Label>
              <div className="mt-1.5 flex gap-1.5">
                {PLAZOS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDays(d)}
                    className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition ${
                      days === d
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {d === 365 ? "1 año" : `${d}d`}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {tab === "pf" && selPf && (
            <div className="rounded-xl bg-[image:var(--gradient-primary)] p-4 text-primary-foreground shadow-[var(--shadow-glow)]">
              <div className="text-xs opacity-90">{selPf.entidad} · Plazo Fijo {days} días</div>
              <div className="mt-1 text-2xl font-bold tracking-tight">
                + ARS {gainPf(amount, showNoClientes ? selPf.tnaNoClientes : selPf.tnaClientes, days).toLocaleString("es-AR")}
              </div>
              <div className="text-xs opacity-90">
                TNA {(showNoClientes ? selPf.tnaNoClientes : selPf.tnaClientes).toFixed(2)}% · TEA {selPf.tea.toFixed(1)}%
              </div>
            </div>
          )}
          {tab === "cr" && selCr && (
            <div className="rounded-xl bg-[image:var(--gradient-primary)] p-4 text-primary-foreground shadow-[var(--shadow-glow)]">
              <div className="text-xs opacity-90">{selCr.nombre} · Cuenta Remunerada {days} días</div>
              <div className="mt-1 text-2xl font-bold tracking-tight">
                + ARS {gainCr(amount, selCr.tea, days).toLocaleString("es-AR")}
              </div>
              <div className="text-xs opacity-90">
                TNA {selCr.tna.toFixed(2)}% · TEA {selCr.tea.toFixed(1)}%
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 w-fit rounded-xl border border-border bg-muted/40 p-1">
        <button
          onClick={() => handleTabChange("pf")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === "pf" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          Plazo Fijo
        </button>
        <button
          onClick={() => handleTabChange("cr")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === "cr" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          Cuentas Remuneradas
        </button>
      </div>

      {/* ── TAB: Plazo Fijo ── */}
      {tab === "pf" && (
        <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Ranking Plazo Fijo · TNA</h3>
              <p className="text-xs text-muted-foreground">
                {pfSorted.length} entidades · datos en tiempo real
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/40 p-1">
              <button
                onClick={() => handleToggleClientes(false)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${!showNoClientes ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Para clientes
              </button>
              <button
                onClick={() => handleToggleClientes(true)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${showNoClientes ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Sin cuenta
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-2.5">
            {pfSorted.map((r, i) => {
              const tna       = showNoClientes ? r.tnaNoClientes : r.tnaClientes;
              const gain      = gainPf(amount, tna, days);
              const isFirst   = i === 0;
              const isSelected = i === selectedPfIdx;
              return (
                <button
                  key={r.entidad}
                  type="button"
                  onClick={() => setSelectedPfIdx(i)}
                  className={`w-full text-left flex flex-wrap items-center gap-3 rounded-xl border p-3.5 transition ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold ${
                    isSelected
                      ? "bg-[image:var(--gradient-primary)] text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {isFirst && !isSelected ? <Trophy className="h-4 w-4" /> : isFirst ? <Trophy className="h-4 w-4" /> : `#${i + 1}`}
                  </div>
                  <EntityLogo src={PF_LOGO_OVERRIDES[r.entidad] ?? r.logo ?? null} name={r.entidad} />
                  <div className="min-w-[150px] flex-1">
                    <div className="text-sm font-semibold">{r.entidad}</div>
                    {r.condicionesCorto && (
                      <div className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">{r.condicionesCorto}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">TNA</div>
                    <div className={`text-sm font-bold ${isSelected ? "text-primary" : "text-primary"}`}>{tna.toFixed(2)}%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">TEA</div>
                    <div className="text-sm font-semibold">{r.tea.toFixed(1)}%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{days === 365 ? "1 año" : `${days} días`}</div>
                    <div className="text-sm font-bold text-success">+ARS {gain.toLocaleString("es-AR")}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              Esta información tiene carácter exclusivamente informativo y no constituye asesoramiento de inversión. Las tasas corresponden a TNA para plazos fijos a 30 días para clientes informados al BCRA y pueden no reflejar las condiciones vigentes. No todas las alternativas conllevan el mismo riesgo. Verificá siempre con cada entidad antes de invertir. Primus no recibe comisión de ninguna entidad.
            </span>
          </div>
        </Card>
      )}

      {/* ── TAB: Cuentas Remuneradas ── */}
      {tab === "cr" && (
        <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Ranking Cuentas Remuneradas · TNA</h3>
              <p className="text-xs text-muted-foreground">
                {crSorted.length} productos · billeteras y bancos digitales · acreditación diaria
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-2.5">
            {crSorted.map((r, i) => {
              const gain       = gainCr(amount, r.tea, days);
              const isFirst    = i === 0;
              const isSelected = i === selectedCrIdx;
              return (
                <button
                  key={`${r.nombre}-${i}`}
                  type="button"
                  onClick={() => setSelectedCrIdx(i)}
                  className={`w-full text-left flex flex-wrap items-center gap-3 rounded-xl border p-3.5 transition ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold ${
                    isSelected
                      ? "bg-[image:var(--gradient-primary)] text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {isFirst ? <Trophy className="h-4 w-4" /> : `#${i + 1}`}
                  </div>
                  <EntityLogo src={crLogoUrl(r.nombre)} name={r.nombre} />
                  <div className="min-w-[150px] flex-1">
                    <div className="text-sm font-semibold">{r.nombre}</div>
                    {(r.condicionesCorto ?? r.tope) && (
                      <div className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
                        {[r.tope, r.condicionesCorto].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">TNA</div>
                    <div className="text-sm font-bold text-primary">{r.tna.toFixed(2)}%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">TEA</div>
                    <div className="text-sm font-semibold">{r.tea.toFixed(1)}%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{days === 365 ? "1 año" : `${days} días`}</div>
                    <div className="text-sm font-bold text-success">+ARS {gain.toLocaleString("es-AR")}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
            <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              Esta información tiene carácter exclusivamente informativo y no constituye asesoramiento de inversión. Los rendimientos proyectados son estimativos y pueden variar. No todas las alternativas conllevan el mismo riesgo. Verificá siempre las condiciones con cada entidad antes de invertir. Primus no recibe comisión de ninguna entidad.
            </span>
          </div>
        </Card>
      )}

    </div>
  );
}
