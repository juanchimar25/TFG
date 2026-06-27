import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, Fragment } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getObligations, type Obligation } from "@/lib/api/obligations.functions";
import { TrendingUp, TrendingDown, Wallet, Plus, X, ChevronDown, RotateCcw } from "lucide-react";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_app/cashflow")({
  loader: async () => {
    const obligations = await getObligations();
    return { obligations };
  },
  component: CashFlow,
});

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Range        = "1m" | "3m" | "6m" | "1y";
type IncomeSource = { id: string; nombre: string; importe: number };
type EgresoItem   = { id: string; emisor: string; monto: string };

type MonthIngreso = { id: string; nombre: string; importe: number };
type MonthEgreso  = { id: string; concepto: string; importe: number };
type MonthData    = { initialized: boolean; ingresos: MonthIngreso[]; egresos: MonthEgreso[] };

// ─── localStorage ─────────────────────────────────────────────────────────────

const LS_SOURCES          = "primus_cf_sources";
const LS_EGRESO_OVERRIDES = "primus_cf_egreso_overrides";
const LS_EGRESO_MANUAL    = "primus_cf_egreso_manual";
const LS_MONTH_PROJ       = "primus_cf_month_proj";
const LS_EGRESO_IMPORTED  = "primus_cf_egreso_imported";

function lsGet<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; }
  catch { return fallback; }
}
function lsSet(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const RANGE_LABELS:  Record<Range, string> = { "1m": "1 mes", "3m": "3 meses", "6m": "6 meses", "1y": "1 año" };
const RANGE_PERIOD:  Record<Range, string> = {
  "1m": "Este mes", "3m": "Próximos 3 meses",
  "6m": "Próximos 6 meses", "1y": "Próximo año",
};
const RANGE_MONTHS:  Record<Range, number> = { "1m": 1, "3m": 3, "6m": 6, "1y": 12 };
const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const GRID_CLASS: Record<Range, string> = {
  "1m": "grid grid-cols-[280px_1fr]",
  "3m": "grid grid-cols-[280px_repeat(3,1fr)]",
  "6m": "grid grid-cols-[280px_repeat(3,1fr)]",
  "1y": "grid grid-cols-[280px_repeat(4,1fr)]",
};
const GRID_COLS: Record<Range, number> = { "1m": 1, "3m": 3, "6m": 3, "1y": 4 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtArs(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000)
    return `ARS ${(abs / 1_000_000).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}M`;
  return `ARS ${abs.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

function fmtNum(n: number): string {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function initEgresosFromStorage(obligations: Obligation[], importedIds: Set<string>): EgresoItem[] {
  const overrides = lsGet<Record<string, { monto: string }>>(LS_EGRESO_OVERRIDES, {});
  const manual    = lsGet<EgresoItem[]>(LS_EGRESO_MANUAL, []);
  const dbItems   = obligations
    .filter(o => importedIds.has(String(o.id_obligacion)))
    .map(o => {
      const id = String(o.id_obligacion);
      return { id, emisor: o.emisor, monto: overrides[id]?.monto ?? String(Math.round(parseFloat(o.monto))) };
    });
  return [...dbItems, ...manual];
}

function buildMonthList(range: Range): { key: string; label: string }[] {
  const today = new Date();
  return Array.from({ length: RANGE_MONTHS[range] }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() + 1 + i, 1);
    return {
      key:   `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
    };
  });
}

// ─── MonthProjectionCards ─────────────────────────────────────────────────────

function MonthProjectionCards({
  range, months, monthData, setMonthData, obligations,
  generalIngresos, generalEgresos, generalSaldo,
}: {
  range:           Range;
  months:          { key: string; label: string }[];
  monthData:       Record<string, MonthData>;
  setMonthData:    React.Dispatch<React.SetStateAction<Record<string, MonthData>>>;
  obligations:     Obligation[];
  generalIngresos: React.ReactNode;
  generalEgresos:  React.ReactNode;
  generalSaldo:    React.ReactNode;
}) {
  const [openState,       setOpenState]       = useState<Record<string, { ing: boolean; egr: boolean }>>({});
  const [showIngForm,     setShowIngForm]     = useState<Record<string, boolean>>({});
  const [showEgrForm,     setShowEgrForm]     = useState<Record<string, boolean>>({});
  const [showImportPanel, setShowImportPanel] = useState<Record<string, boolean>>({});
  const [ingForm,         setIngForm]         = useState<Record<string, { nombre: string; importe: string }>>({});
  const [egrForm,         setEgrForm]         = useState<Record<string, { concepto: string; importe: string }>>({});

  const toggle = (key: string, field: "ing" | "egr") =>
    setOpenState(p => ({ ...p, [key]: { ...p[key], [field]: !(p[key]?.[field]) } }));

  const importOblToMonth = (key: string, o: Obligation) => {
    setMonthData(p => ({
      ...p,
      [key]: {
        ...p[key],
        egresos: [...p[key].egresos, {
          id:       String(o.id_obligacion),
          concepto: o.emisor,
          importe:  Math.round(parseFloat(String(o.monto))),
        }],
      },
    }));
    setShowImportPanel(p => ({ ...p, [key]: false }));
  };

  const updateIngItem = (key: string, id: string, field: keyof MonthIngreso, raw: string) =>
    setMonthData(p => ({
      ...p,
      [key]: {
        ...p[key],
        ingresos: p[key].ingresos.map(i =>
          i.id !== id ? i : field === "importe" ? { ...i, importe: parseFloat(raw) || 0 } : { ...i, nombre: raw }
        ),
      },
    }));

  const removeIngItem = (key: string, id: string) =>
    setMonthData(p => ({ ...p, [key]: { ...p[key], ingresos: p[key].ingresos.filter(i => i.id !== id) } }));

  const addIngItem = (key: string) => {
    const f = ingForm[key];
    if (!f?.nombre.trim() || !f.importe) return;
    setMonthData(p => ({
      ...p,
      [key]: { ...p[key], ingresos: [...p[key].ingresos, { id: `${Date.now()}`, nombre: f.nombre.trim(), importe: parseFloat(f.importe) || 0 }] },
    }));
    setIngForm(p => ({ ...p, [key]: { nombre: "", importe: "" } }));
    setShowIngForm(p => ({ ...p, [key]: false }));
  };

  const updateEgrItem = (key: string, id: string, field: keyof MonthEgreso, raw: string) =>
    setMonthData(p => ({
      ...p,
      [key]: {
        ...p[key],
        egresos: p[key].egresos.map(e =>
          e.id !== id ? e : field === "importe" ? { ...e, importe: parseFloat(raw) || 0 } : { ...e, concepto: raw }
        ),
      },
    }));

  const removeEgrItem = (key: string, id: string) =>
    setMonthData(p => ({ ...p, [key]: { ...p[key], egresos: p[key].egresos.filter(e => e.id !== id) } }));

  const addEgrItem = (key: string) => {
    const f = egrForm[key];
    if (!f?.concepto.trim() || !f.importe) return;
    setMonthData(p => ({
      ...p,
      [key]: { ...p[key], egresos: [...p[key].egresos, { id: `${Date.now()}`, concepto: f.concepto.trim(), importe: parseFloat(f.importe) || 0 }] },
    }));
    setEgrForm(p => ({ ...p, [key]: { concepto: "", importe: "" } }));
    setShowEgrForm(p => ({ ...p, [key]: false }));
  };

  const cols = GRID_COLS[range];
  const chunks: { key: string; label: string }[][] = [];
  for (let i = 0; i < months.length; i += cols) chunks.push(months.slice(i, i + cols));

  const colBorder = (i: number, len: number) => i < len - 1 ? "border-r border-border" : "";

  return (
    <div className={GRID_CLASS[range]}>
      {chunks.map((chunk, chunkIdx) => (
        <Fragment key={chunkIdx}>
          {chunkIdx > 0 && <div className="col-span-full h-8" />}

          {/* ── Fila de encabezados ── */}
          <div className="px-5 pb-5 border-r border-border">
            {chunkIdx === 0 && (
              <div className="flex items-center gap-3">
                <span className="shrink-0 text-base font-semibold text-foreground">Resumen</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            )}
          </div>
          {chunk.map((m, i) => (
            <div key={`${m.key}-hdr`} className={`px-5 pb-5 ${colBorder(i, chunk.length)}`}>
              <div className="flex items-center gap-3">
                <span className="shrink-0 text-base font-semibold text-foreground">{m.label}</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            </div>
          ))}

          {/* ── Fila Ingresos ── */}
          <div className="px-5 pb-4 border-r border-border">
            {chunkIdx === 0 ? generalIngresos : null}
          </div>
          {chunk.map((m, i) => {
            const data    = monthData[m.key];
            const ing     = data?.ingresos.reduce((s, x) => s + x.importe, 0) ?? 0;
            const hasIng  = ing > 0;
            const ingOpen = openState[m.key]?.ing ?? false;
            const ingF    = ingForm[m.key] ?? { nombre: "", importe: "" };
            return (
              <div key={`${m.key}-ing`} className={`px-5 pb-4 ${colBorder(i, chunk.length)}`}>
                <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Ingresos proyectados</span>
                    <div className="flex items-center gap-1.5">
                      <div className="grid h-8 w-8 place-items-center rounded-lg bg-success/10 text-success">
                        <TrendingUp className="h-4 w-4" />
                      </div>
                      <button onClick={() => toggle(m.key, "ing")}
                        className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground">
                        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${ingOpen ? "" : "-rotate-90"}`} />
                      </button>
                    </div>
                  </div>
                  <div className={`mt-3 text-2xl font-bold tracking-tight ${hasIng ? "text-success" : "text-muted-foreground"}`}>
                    {hasIng ? fmtArs(ing) : "—"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{m.label}</div>
                  {ingOpen && (
                    <>
                      {(data?.ingresos.length ?? 0) > 0 && (
                        <div className="mt-4 space-y-1.5">
                          {data!.ingresos.map(item => (
                            <div key={item.id} className="flex items-center gap-1.5 rounded-xl bg-muted/40 px-2 py-1.5">
                              <Input className="h-7 min-w-0 flex-1 rounded-lg text-xs font-medium"
                                value={item.nombre}
                                onChange={e => updateIngItem(m.key, item.id, "nombre", e.target.value)} />
                              <Input className="h-7 w-28 shrink-0 rounded-lg text-right text-xs"
                                type="text" inputMode="numeric"
                                value={item.importe ? fmtNum(item.importe) : ""}
                                onChange={e => updateIngItem(m.key, item.id, "importe", e.target.value.replace(/\D/g, ""))} />
                              <button onClick={() => removeIngItem(m.key, item.id)}
                                className="shrink-0 text-muted-foreground/50 transition hover:text-destructive">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {showIngForm[m.key] ? (
                        <div className="mt-3 space-y-2 rounded-xl border border-border bg-muted/30 p-3">
                          <Input className="h-8 rounded-lg text-xs" placeholder="Fuente de ingreso" autoFocus
                            value={ingF.nombre}
                            onChange={e => setIngForm(p => ({ ...p, [m.key]: { ...ingF, nombre: e.target.value } }))} />
                          <Input className="h-8 rounded-lg text-xs" type="text" inputMode="numeric" placeholder="Importe (ARS)"
                            value={ingF.importe ? Number(ingF.importe).toLocaleString("es-AR", { maximumFractionDigits: 0 }) : ""}
                            onChange={e => setIngForm(p => ({ ...p, [m.key]: { ...ingF, importe: e.target.value.replace(/\D/g, "") } }))} />
                          <div className="flex gap-2">
                            <Button size="sm" className="h-7 flex-1 rounded-lg text-xs shadow-none"
                              onClick={() => addIngItem(m.key)} disabled={!ingF.nombre.trim() || !ingF.importe}>
                              Agregar
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 rounded-lg text-xs"
                              onClick={() => { setShowIngForm(p => ({ ...p, [m.key]: false })); setIngForm(p => ({ ...p, [m.key]: { nombre: "", importe: "" } })); }}>
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setShowIngForm(p => ({ ...p, [m.key]: true }))}
                          className="mt-3 flex w-full items-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-primary">
                          <Plus className="h-3.5 w-3.5" /> Agregar fuente de ingreso
                        </button>
                      )}
                    </>
                  )}
                </Card>
              </div>
            );
          })}

          {/* ── Fila Egresos ── */}
          <div className="px-5 pb-4 border-r border-border">
            {chunkIdx === 0 ? generalEgresos : null}
          </div>
          {chunk.map((m, i) => {
            const data    = monthData[m.key];
            const egr     = data?.egresos.reduce((s, x) => s + x.importe, 0) ?? 0;
            const egrOpen = openState[m.key]?.egr ?? false;
            const egrF    = egrForm[m.key] ?? { concepto: "", importe: "" };
            const existingEgrIds = new Set((data?.egresos ?? []).map(e => e.id));
            const availForMonth  = obligations.filter(o => !existingEgrIds.has(String(o.id_obligacion)));
            return (
              <div key={`${m.key}-egr`} className={`px-5 pb-4 ${colBorder(i, chunk.length)}`}>
                <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Egresos proyectados</span>
                    <div className="flex items-center gap-1.5">
                      <div className="grid h-8 w-8 place-items-center rounded-lg bg-destructive/10 text-destructive">
                        <TrendingDown className="h-4 w-4" />
                      </div>
                      <button onClick={() => toggle(m.key, "egr")}
                        className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground">
                        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${egrOpen ? "" : "-rotate-90"}`} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 text-2xl font-bold tracking-tight text-destructive">
                    {egr > 0 ? fmtArs(egr) : "—"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{m.label}</div>
                  {egrOpen && (
                    <>
                      {(data?.egresos.length ?? 0) > 0 && (
                        <div className="mt-4 space-y-1.5">
                          {data!.egresos.map(item => (
                            <div key={item.id} className="flex items-center gap-1.5 rounded-xl bg-muted/40 px-2 py-1.5">
                              <Input className="h-7 min-w-0 flex-1 rounded-lg text-xs font-medium"
                                value={item.concepto}
                                onChange={e => updateEgrItem(m.key, item.id, "concepto", e.target.value)} />
                              <Input className="h-7 w-28 shrink-0 rounded-lg text-right text-xs"
                                type="text" inputMode="numeric"
                                value={item.importe ? fmtNum(item.importe) : ""}
                                onChange={e => updateEgrItem(m.key, item.id, "importe", e.target.value.replace(/\D/g, ""))} />
                              <button onClick={() => removeEgrItem(m.key, item.id)}
                                className="shrink-0 text-muted-foreground/50 transition hover:text-destructive">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {showEgrForm[m.key] ? (
                        <div className="mt-3 space-y-2 rounded-xl border border-border bg-muted/30 p-3">
                          <Input className="h-8 rounded-lg text-xs" placeholder="Concepto" autoFocus
                            value={egrF.concepto}
                            onChange={e => setEgrForm(p => ({ ...p, [m.key]: { ...egrF, concepto: e.target.value } }))} />
                          <Input className="h-8 rounded-lg text-xs" type="text" inputMode="numeric" placeholder="Importe (ARS)"
                            value={egrF.importe ? Number(egrF.importe).toLocaleString("es-AR", { maximumFractionDigits: 0 }) : ""}
                            onChange={e => setEgrForm(p => ({ ...p, [m.key]: { ...egrF, importe: e.target.value.replace(/\D/g, "") } }))} />
                          <div className="flex gap-2">
                            <Button size="sm" className="h-7 flex-1 rounded-lg text-xs shadow-none"
                              onClick={() => addEgrItem(m.key)} disabled={!egrF.concepto.trim() || !egrF.importe}>
                              Agregar
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 rounded-lg text-xs"
                              onClick={() => { setShowEgrForm(p => ({ ...p, [m.key]: false })); setEgrForm(p => ({ ...p, [m.key]: { concepto: "", importe: "" } })); }}>
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setShowEgrForm(p => ({ ...p, [m.key]: true }))}
                          className="mt-3 flex w-full items-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition hover:border-destructive/40 hover:text-destructive">
                          <Plus className="h-3.5 w-3.5" /> Agregar egreso manualmente
                        </button>
                      )}
                      {showImportPanel[m.key] ? (
                        <div className="mt-2 rounded-xl border border-border bg-muted/20 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs font-semibold">Importar obligación</span>
                            <button onClick={() => setShowImportPanel(p => ({ ...p, [m.key]: false }))}
                              className="text-muted-foreground/50 transition hover:text-foreground">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          {availForMonth.length > 0 ? (
                            <div className="space-y-1.5">
                              {availForMonth.map(o => (
                                <div key={o.id_obligacion} className="flex items-center justify-between rounded-lg bg-background px-2.5 py-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      {o.pagado && <span className="shrink-0 rounded-md bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">Pagada</span>}
                                      <span className="truncate text-xs font-medium">{o.emisor}</span>
                                    </div>
                                    <div className="text-[11px] text-muted-foreground">
                                      ARS {Number(o.monto).toLocaleString("es-AR")} · {new Date(o.fecha_vencimiento + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
                                    </div>
                                  </div>
                                  <button onClick={() => importOblToMonth(m.key, o)}
                                    className="ml-2 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive transition hover:bg-destructive hover:text-destructive-foreground">
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="py-2 text-center text-xs text-muted-foreground">No hay obligaciones para importar.</p>
                          )}
                        </div>
                      ) : availForMonth.length > 0 ? (
                        <button onClick={() => setShowImportPanel(p => ({ ...p, [m.key]: true }))}
                          className="mt-2 flex w-full items-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition hover:border-destructive/40 hover:text-destructive">
                          <Plus className="h-3.5 w-3.5" /> Importar desde Obligaciones ({availForMonth.length})
                        </button>
                      ) : null}
                    </>
                  )}
                </Card>
              </div>
            );
          })}

          {/* ── Fila Saldo ── */}
          <div className="px-5 border-r border-border">
            {chunkIdx === 0 ? generalSaldo : null}
          </div>
          {chunk.map((m, i) => {
            const data   = monthData[m.key];
            const ing    = data?.ingresos.reduce((s, x) => s + x.importe, 0) ?? 0;
            const egr    = data?.egresos.reduce((s, x) => s + x.importe, 0) ?? 0;
            const saldo  = ing - egr;
            const pos    = saldo >= 0;
            const hasIng = ing > 0;
            return (
              <div key={`${m.key}-saldo`} className={`px-5 ${colBorder(i, chunk.length)}`}>
                <Card className={`rounded-2xl border p-5 shadow-[var(--shadow-soft)] ${
                  !hasIng ? "border-border" :
                  pos ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Saldo proyectado</span>
                    <div className={`grid h-8 w-8 place-items-center rounded-lg ${
                      !hasIng ? "bg-muted text-muted-foreground" :
                      pos ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                    }`}>
                      <Wallet className="h-4 w-4" />
                    </div>
                  </div>
                  <div className={`mt-3 text-2xl font-bold tracking-tight ${
                    !hasIng ? "text-muted-foreground" : pos ? "text-success" : "text-destructive"
                  }`}>
                    {hasIng ? `${pos ? "+" : "−"}${fmtArs(saldo)}` : "—"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{m.label}</div>
                </Card>
              </div>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}

// ─── Componente ───────────────────────────────────────────────────────────────

function CashFlow() {
  const { obligations } = Route.useLoaderData();

  const [range, setRange] = useState<Range>("1m");

  const [sources, setSources] = useState<IncomeSource[]>(() => lsGet<IncomeSource[]>(LS_SOURCES, []));
  useEffect(() => { lsSet(LS_SOURCES, sources); }, [sources]);

  const [importedDbIds, setImportedDbIds] = useState<string[]>(() => lsGet<string[]>(LS_EGRESO_IMPORTED, []));
  useEffect(() => { lsSet(LS_EGRESO_IMPORTED, importedDbIds); }, [importedDbIds]);

  const [egresoItems, setEgresoItems] = useState<EgresoItem[]>(() => {
    const imported = new Set(lsGet<string[]>(LS_EGRESO_IMPORTED, []));
    return initEgresosFromStorage(obligations, imported);
  });
  useEffect(() => {
    const overrides: Record<string, { monto: string }> = {};
    egresoItems.forEach(e => {
      if (!e.id.startsWith("m_")) overrides[e.id] = { monto: e.monto };
    });
    lsSet(LS_EGRESO_OVERRIDES, overrides);
    lsSet(LS_EGRESO_MANUAL, egresoItems.filter(e => e.id.startsWith("m_")));
  }, [egresoItems]);

  const [monthData, setMonthData] = useState<Record<string, MonthData>>(
    () => lsGet<Record<string, MonthData>>(LS_MONTH_PROJ, {})
  );
  useEffect(() => { lsSet(LS_MONTH_PROJ, monthData); }, [monthData]);

  // Propagar ítems nuevos del panel izquierdo a meses ya inicializados
  useEffect(() => {
    setMonthData(prev => {
      let changed = false;
      const next: Record<string, MonthData> = {};
      for (const key of Object.keys(prev)) {
        const monthD = prev[key];
        if (!monthD?.initialized) { next[key] = monthD; continue; }
        const existingIngIds = new Set(monthD.ingresos.map(i => i.id));
        const newIngresos = sources
          .filter(s => !existingIngIds.has(s.id))
          .map(s => ({ id: s.id, nombre: s.nombre, importe: s.importe }));
        const existingEgrIds = new Set(monthD.egresos.map(e => e.id));
        const newEgresos = egresoItems
          .filter(e => !existingEgrIds.has(e.id))
          .map(e => ({ id: e.id, concepto: e.emisor, importe: parseFloat(e.monto) || 0 }));
        if (newIngresos.length > 0 || newEgresos.length > 0) {
          next[key] = {
            ...monthD,
            ingresos: [...monthD.ingresos, ...newIngresos],
            egresos:  [...monthD.egresos,  ...newEgresos],
          };
          changed = true;
        } else {
          next[key] = monthD;
        }
      }
      return changed ? next : prev;
    });
  }, [sources, egresoItems]); // eslint-disable-line react-hooks/exhaustive-deps

  const months = buildMonthList(range);

  // Inicializar meses nuevos con los defaults actuales de la izquierda (solo una vez por mes)
  useEffect(() => {
    const monthKey = months.map(m => m.key).join(",");
    setMonthData(prev => {
      const toInit = months.filter(m => !prev[m.key]?.initialized);
      if (toInit.length === 0) return prev;
      const next = { ...prev };
      toInit.forEach(m => {
        next[m.key] = {
          initialized: true,
          ingresos: sources.map(s => ({ id: s.id, nombre: s.nombre, importe: s.importe })),
          egresos:  egresoItems.map(e => ({ id: e.id, concepto: e.emisor, importe: parseFloat(e.monto) || 0 })),
        };
      });
      return next;
    });
  }, [months.map(m => m.key).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const [incomesOpen, setIncomesOpen] = useState(false);
  const [egresosOpen, setEgresosOpen] = useState(false);

  const [showForm, setShowForm]     = useState(false);
  const [fNombre, setFNombre]       = useState("");
  const [fImporte, setFImporte]     = useState("");

  const [showEgresoForm, setShowEgresoForm]   = useState(false);
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [fEgresoNombre, setFEgresoNombre]   = useState("");
  const [fEgresoImporte, setFEgresoImporte] = useState("");

  const monthlyIncome  = sources.reduce((s, x) => s + x.importe, 0);
  const monthlyEgresos = egresoItems.reduce((s, e) => s + (parseFloat(e.monto) || 0), 0);

  // Sumar valores reales de cada mes (respeta ediciones individuales)
  const projIngresos = months.reduce((sum, m) => {
    const data = monthData[m.key];
    return sum + (data?.initialized
      ? data.ingresos.reduce((s, x) => s + x.importe, 0)
      : monthlyIncome);
  }, 0);
  const projEgresos = months.reduce((sum, m) => {
    const data = monthData[m.key];
    return sum + (data?.initialized
      ? data.egresos.reduce((s, x) => s + x.importe, 0)
      : monthlyEgresos);
  }, 0);
  const saldo = projIngresos - projEgresos;
  const hasIncome      = sources.length > 0;
  const positive       = saldo >= 0;

  const availableObligations = obligations.filter(
    o => !importedDbIds.includes(String(o.id_obligacion))
  );

  const handleAddIncome = () => {
    const imp = parseFloat(fImporte);
    if (!fNombre.trim() || isNaN(imp) || imp <= 0) return;
    setSources(prev => [...prev, { id: `${Date.now()}`, nombre: fNombre.trim(), importe: imp }]);
    setFNombre(""); setFImporte(""); setShowForm(false);
  };
  const handleCancelForm = () => { setShowForm(false); setFNombre(""); setFImporte(""); };

  const updateEgresoMonto = (id: string, raw: string) =>
    setEgresoItems(p => p.map(e => e.id === id ? { ...e, monto: raw } : e));
  const removeEgreso = (id: string) => {
    setEgresoItems(p => p.filter(e => e.id !== id));
    if (!id.startsWith("m_")) setImportedDbIds(p => p.filter(i => i !== id));
  };

  const importObligacion = (o: Obligation) => {
    const id = String(o.id_obligacion);
    const overrides = lsGet<Record<string, { monto: string }>>(LS_EGRESO_OVERRIDES, {});
    setEgresoItems(p => [...p, {
      id,
      emisor: o.emisor,
      monto:  overrides[id]?.monto ?? String(Math.round(parseFloat(String(o.monto)))),
    }]);
    setImportedDbIds(p => [...p, id]);
  };

  const handleAddEgreso = () => {
    const imp = parseFloat(fEgresoImporte);
    if (!fEgresoNombre.trim() || isNaN(imp) || imp <= 0) return;
    setEgresoItems(prev => [...prev, { id: `m_${Date.now()}`, emisor: fEgresoNombre.trim(), monto: String(imp) }]);
    setFEgresoNombre(""); setFEgresoImporte(""); setShowEgresoForm(false);
  };
  const handleCancelEgresoForm = () => {
    setShowEgresoForm(false); setFEgresoNombre(""); setFEgresoImporte("");
  };

  const handleResetProjections = () => {
    setSources([]);
    setEgresoItems([]);
    setImportedDbIds([]);
    setMonthData(prev => {
      const next: Record<string, MonthData> = {};
      Object.keys(prev).forEach(k => { next[k] = { initialized: false, ingresos: [], egresos: [] }; });
      return next;
    });
  };

  const generalIngresos = (
          <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Ingresos proyectados</span>
              <div className="flex items-center gap-1.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-success/10 text-success">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <button onClick={() => setIncomesOpen(p => !p)}
                  className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground">
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${incomesOpen ? "" : "-rotate-90"}`} />
                </button>
              </div>
            </div>
            <div className={`mt-3 text-2xl font-bold tracking-tight ${hasIncome ? "text-success" : "text-muted-foreground"}`}>
              {hasIncome ? fmtArs(projIngresos) : "—"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{RANGE_PERIOD[range]}</div>

            {incomesOpen && (
              <>
                {sources.length > 0 && (
                  <div className="mt-4 space-y-1.5">
                    {sources.map(s => (
                      <div key={s.id} className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium">{s.nombre}</div>
                          <div className="text-[11px] text-muted-foreground">
                            ARS {s.importe.toLocaleString("es-AR")} c/mes
                          </div>
                        </div>
                        <button onClick={() => setSources(p => p.filter(x => x.id !== s.id))}
                          className="ml-2 shrink-0 text-muted-foreground/50 transition hover:text-destructive">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {showForm ? (
                  <div className="mt-4 space-y-2.5 rounded-xl border border-border bg-muted/30 p-3">
                    <div>
                      <Label className="text-xs">Fuente de ingreso</Label>
                      <input className="mt-1 h-8 w-full rounded-lg border border-border bg-background px-3 text-xs" placeholder="Sueldo, Honorarios, Jubilación…"
                        value={fNombre} onChange={e => setFNombre(e.target.value)} autoFocus />
                    </div>
                    <div>
                      <Label className="text-xs">Importe mensual (ARS)</Label>
                      <input className="mt-1 h-8 w-full rounded-lg border border-border bg-background px-3 text-xs" type="text" inputMode="numeric" placeholder="Ej: 500.000"
                        value={fImporte ? Number(fImporte).toLocaleString("es-AR", { maximumFractionDigits: 0 }) : ""}
                        onChange={e => setFImporte(e.target.value.replace(/\D/g, ""))} />
                    </div>
                    <div className="flex gap-2 pt-0.5">
                      <Button size="sm" className="h-8 flex-1 rounded-lg text-xs shadow-none"
                        onClick={handleAddIncome} disabled={!fNombre.trim() || !fImporte}>
                        Agregar
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 rounded-lg text-xs" onClick={handleCancelForm}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowForm(true)}
                    className="mt-4 flex w-full items-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-primary">
                    <Plus className="h-3.5 w-3.5" /> Agregar fuente de ingreso
                  </button>
                )}
              </>
            )}
          </Card>
  );

  const generalEgresos = (
          <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Egresos proyectados</span>
              <div className="flex items-center gap-1.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-destructive/10 text-destructive">
                  <TrendingDown className="h-4 w-4" />
                </div>
                <button onClick={() => setEgresosOpen(p => !p)}
                  className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground">
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${egresosOpen ? "" : "-rotate-90"}`} />
                </button>
              </div>
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight text-destructive">
              {projEgresos > 0 ? fmtArs(projEgresos) : "—"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{RANGE_PERIOD[range]}</div>

            {egresosOpen && (
              <>
                {egresoItems.length > 0 ? (
                  <div className="mt-4 space-y-1.5">
                    {egresoItems.map(e => (
                      <div key={e.id} className="flex items-center gap-1.5 rounded-xl bg-muted/40 px-2 py-1.5">
                        {!e.id.startsWith("m_") && (
                          <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">OBL</span>
                        )}
                        <span className="min-w-0 flex-1 truncate text-xs font-medium">{e.emisor}</span>
                        <input className="h-7 w-28 shrink-0 rounded-lg border border-border bg-background px-2 text-right text-xs" type="text" inputMode="numeric"
                          value={e.monto ? Number(e.monto).toLocaleString("es-AR", { maximumFractionDigits: 0 }) : ""}
                          onChange={ev => updateEgresoMonto(e.id, ev.target.value.replace(/\D/g, ""))}
                          placeholder="Importe" />
                        <button onClick={() => removeEgreso(e.id)}
                          className="shrink-0 text-muted-foreground/50 transition hover:text-destructive">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-center text-xs text-muted-foreground">Sin egresos registrados.</p>
                )}

                {/* Panel de importación desde Obligaciones */}
                {showImportPanel ? (
                  <div className="mt-3 rounded-xl border border-border bg-muted/20 p-3">
                    <div className="mb-2.5 flex items-center justify-between">
                      <span className="text-xs font-semibold">Importar obligación</span>
                      <button onClick={() => setShowImportPanel(false)}
                        className="text-muted-foreground/50 transition hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {availableObligations.length > 0 ? (
                      <div className="space-y-1.5">
                        {availableObligations.map(o => (
                          <div key={o.id_obligacion} className="flex items-center justify-between rounded-lg bg-background px-2.5 py-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                {o.pagado && <span className="shrink-0 rounded-md bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">Pagada</span>}
                                <span className="truncate text-xs font-medium">{o.emisor}</span>
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                ARS {Number(o.monto).toLocaleString("es-AR")} · vence {new Date(o.fecha_vencimiento + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
                              </div>
                            </div>
                            <button onClick={() => importObligacion(o)}
                              className="ml-2 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive transition hover:bg-destructive hover:text-destructive-foreground">
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="py-2 text-center text-xs text-muted-foreground">No hay obligaciones pendientes para importar.</p>
                    )}
                  </div>
                ) : availableObligations.length > 0 ? (
                  <button onClick={() => setShowImportPanel(true)}
                    className="mt-3 flex w-full items-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition hover:border-destructive/40 hover:text-destructive">
                    <Plus className="h-3.5 w-3.5" /> Importar desde Obligaciones ({availableObligations.length})
                  </button>
                ) : null}
                {showEgresoForm ? (
                  <div className="mt-3 space-y-2.5 rounded-xl border border-border bg-muted/30 p-3">
                    <div>
                      <Label className="text-xs">Concepto</Label>
                      <input className="mt-1 h-8 w-full rounded-lg border border-border bg-background px-3 text-xs" placeholder="Alquiler, Seguro, Cuota…"
                        value={fEgresoNombre} onChange={e => setFEgresoNombre(e.target.value)} autoFocus />
                    </div>
                    <div>
                      <Label className="text-xs">Importe (ARS)</Label>
                      <input className="mt-1 h-8 w-full rounded-lg border border-border bg-background px-3 text-xs" type="text" inputMode="numeric" placeholder="Ej: 150.000"
                        value={fEgresoImporte ? Number(fEgresoImporte).toLocaleString("es-AR", { maximumFractionDigits: 0 }) : ""}
                        onChange={e => setFEgresoImporte(e.target.value.replace(/\D/g, ""))} />
                    </div>
                    <div className="flex gap-2 pt-0.5">
                      <Button size="sm" className="h-8 flex-1 rounded-lg text-xs shadow-none"
                        onClick={handleAddEgreso} disabled={!fEgresoNombre.trim() || !fEgresoImporte}>
                        Agregar
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 rounded-lg text-xs" onClick={handleCancelEgresoForm}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowEgresoForm(true)}
                    className="mt-3 flex w-full items-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition hover:border-destructive/40 hover:text-destructive">
                    <Plus className="h-3.5 w-3.5" /> Agregar egreso manualmente
                  </button>
                )}
              </>
            )}
          </Card>
  );

  const generalSaldo = (
          <Card className={`rounded-2xl border p-5 shadow-[var(--shadow-soft)] ${
            !hasIncome ? "border-border" :
            positive ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Saldo proyectado</span>
              <div className={`grid h-8 w-8 place-items-center rounded-lg ${
                !hasIncome ? "bg-muted text-muted-foreground" :
                positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
              }`}>
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <div className={`mt-3 text-2xl font-bold tracking-tight ${
              !hasIncome ? "text-muted-foreground" : positive ? "text-success" : "text-destructive"
            }`}>
              {hasIncome ? `${positive ? "+" : "−"}${fmtArs(saldo)}` : "—"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {hasIncome ? RANGE_PERIOD[range] : "Agregá ingresos para calcular el saldo"}
            </div>
          </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Proyección mensual</h3>
          <p className="text-xs text-muted-foreground">Estimado mes a mes — editable, se guarda automáticamente</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleResetProjections}
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-destructive/40 hover:text-destructive">
            <RotateCcw className="h-3.5 w-3.5" /> Resetear
          </button>
          <div className="inline-flex rounded-xl bg-muted p-1 text-xs">
            {(["1m", "3m", "6m", "1y"] as Range[]).map(r => (
              <button key={r} onClick={() => setRange(r)}
                className={`rounded-lg px-3 py-1.5 font-medium transition ${
                  range === r ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}>
                {RANGE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <MonthProjectionCards
        range={range}
        months={months}
        monthData={monthData}
        setMonthData={setMonthData}
        obligations={obligations}
        generalIngresos={generalIngresos}
        generalEgresos={generalEgresos}
        generalSaldo={generalSaldo}
      />
    </div>
  );
}
