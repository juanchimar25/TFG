import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Landmark, Award, Info } from "lucide-react";
import { PESOS_PRODUCTS } from "@/lib/api/loans-data";

export const Route = createFileRoute("/_app/loans")({
  component: Loans,
});

// ─── Logo helpers ─────────────────────────────────────────────────────────────

const LOCAL_LOGOS: Record<string, string> = {
  "Banco Supervielle": "/logos/supervielle.png",
  "Ualá":              "/logos/uala.png",
  "Banco Provincia":   "/logos/provincia.png",
  "Banco Ciudad":      "/logos/ciudad.png",
  "Banco Galicia":     "/logos/galicia.png",
  "Banco Macro":       "/logos/macro.png",
  "Banco Patagonia":   "/logos/patagonia.png",
};

const FAVICON_DOMAINS: Record<string, string> = {
  "Banco Nación":      "bna.com.ar",
  "Banco Provincia":   "bancoprovincia.com.ar",
  "Banco Ciudad":      "bancociudad.com.ar",
  "Santander":         "santander.com.ar",
  "BBVA":              "bbva.com.ar",
  "Naranja X":         "naranjax.com",
  "Mercado Pago":      "mercadopago.com.ar",
};

function loanLogoUrl(entidad: string): string | null {
  if (LOCAL_LOGOS[entidad]) return LOCAL_LOGOS[entidad];
  const d = FAVICON_DOMAINS[entidad];
  return d ? `https://www.google.com/s2/favicons?domain=${d}&sz=64` : null;
}

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
      <img src={src} alt="" className="h-7 w-7 object-contain" onError={() => setErr(true)} />
    </div>
  );
}

// ─── Cálculo cuota (sistema francés) ─────────────────────────────────────────

function cuotaMensual(cft: number, monto: number, meses: number): number {
  const i = cft / 100 / 12;
  if (i === 0) return Math.round(monto / meses);
  return Math.round((monto * i) / (1 - Math.pow(1 + i, -meses)));
}

function fmtArs(n: number): string {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function fmtPlazo(p: number): string {
  return p % 12 === 0 ? `${p / 12}a` : `${p}m`;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const PLAZOS = [6, 12, 24, 36, 48, 60, 72];

// ─── Componente ───────────────────────────────────────────────────────────────

function Loans() {
  const [amount, setAmount]           = useState(1_000_000);
  const [plazo, setPlazo]             = useState(24);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const selected     = PESOS_PRODUCTS[selectedIdx];
  const selAvailable = selected && plazo <= selected.plazoMax;
  const selCuota     = selAvailable ? cuotaMensual(selected.cft, amount, plazo) : null;
  const selTotal     = selCuota != null ? selCuota * plazo : null;
  const selIntereses = selTotal != null ? selTotal - amount : null;

  const bestCuota = cuotaMensual(PESOS_PRODUCTS[0].cft, amount, plazo);

  return (
    <div className="space-y-6">

      {/* ── Calculadora ── */}
      <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
            <Landmark className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold">Calculadora de Cuotas</h3>
            <p className="text-xs text-muted-foreground">
              Seleccioná una entidad del ranking para calcular tu cuota mensual.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-2 md:items-end">
            <div>
              <Label htmlFor="amount">Monto (ARS)</Label>
              <Input
                id="amount"
                type="text"
                inputMode="numeric"
                value={amount === 0 ? "" : amount.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  setAmount(raw ? Number(raw) : 0);
                }}
                className="mt-1.5 h-12 rounded-xl text-lg font-semibold"
              />
            </div>
            <div>
              <Label>Plazo</Label>
              <div className="mt-1.5 flex gap-1.5">
                {PLAZOS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlazo(p)}
                    className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition ${
                      plazo === p
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {fmtPlazo(p)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {selected && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-[image:var(--gradient-primary)] p-4 text-primary-foreground shadow-[var(--shadow-glow)]">
                <div className="text-xs opacity-90">{selected.entidad} · Cuota mensual</div>
                <div className="mt-1 text-2xl font-bold tracking-tight">
                  {selCuota != null ? `ARS ${fmtArs(selCuota)}` : "Plazo no disponible"}
                </div>
                <div className="text-xs opacity-90">CFT {selected.cft.toFixed(1)}% · TNA {selected.tna.toFixed(1)}%</div>
              </div>
              {selTotal != null && (
                <>
                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total a pagar</div>
                    <div className="mt-1 text-xl font-bold">ARS {fmtArs(selTotal)}</div>
                    <div className="text-xs text-muted-foreground">en {plazo} cuotas</div>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Costo financiero</div>
                    <div className="mt-1 text-xl font-bold text-destructive">ARS {fmtArs(selIntereses!)}</div>
                    <div className="text-xs text-muted-foreground">sobre ARS {fmtArs(amount)}</div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* ── Ranking ── */}
      <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)]">
        <div>
          <h3 className="text-base font-semibold">Ranking por Costo Financiero Total</h3>
          <p className="text-xs text-muted-foreground">
            {PESOS_PRODUCTS.length} principales oferentes · ordenado de menor a mayor CFT
          </p>
        </div>

        <div className="mt-5 space-y-2.5">
          {PESOS_PRODUCTS.map((r, i) => {
            const available  = plazo <= r.plazoMax;
            const c          = available ? cuotaMensual(r.cft, amount, plazo) : null;
            const diff       = c != null ? c * plazo - bestCuota * plazo : null;
            const isFirst    = i === 0;
            const isSelected = i === selectedIdx;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => available && setSelectedIdx(i)}
                disabled={!available}
                className={`w-full text-left flex flex-wrap items-center gap-3 rounded-xl border p-3.5 transition ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : available
                      ? "border-border bg-card hover:border-primary/40"
                      : "border-border bg-muted/30 opacity-40 cursor-not-allowed"
                }`}
              >
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold ${
                  isSelected
                    ? "bg-[image:var(--gradient-primary)] text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {isFirst ? <Award className="h-4 w-4" /> : `#${i + 1}`}
                </div>
                <EntityLogo src={loanLogoUrl(r.entidad)} name={r.entidad} />
                <div className="min-w-[150px] flex-1">
                  <div className="text-sm font-semibold">{r.entidad}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
                    {r.limiteVariable
                      ? "límite variable"
                      : [r.condiciones, `hasta ARS ${fmtArs(r.montoMax)}`].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">TNA</div>
                  <div className="text-sm font-bold">{r.tna.toFixed(1)}%</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">CFT</div>
                  <div className={`text-sm font-bold ${isFirst ? "text-success" : ""}`}>{r.cft.toFixed(1)}%</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cuota</div>
                  <div className="text-sm font-bold">
                    {c != null ? `ARS ${fmtArs(c)}` : "—"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">vs. mejor</div>
                  <div className={`text-sm font-bold ${isFirst ? "text-success" : "text-destructive"}`}>
                    {!available
                      ? "Plazo no disponible"
                      : isFirst
                        ? "—"
                        : `+ARS ${fmtArs(diff!)}`}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            Esta información tiene carácter exclusivamente informativo y no constituye asesoramiento financiero. Las tasas y CFT provienen del Régimen de Transparencia del BCRA y pueden no reflejar las condiciones vigentes. Verificá siempre directamente con cada entidad antes de contratar. Primus no recibe comisión de ninguna entidad.
          </span>
        </div>
      </Card>
    </div>
  );
}
