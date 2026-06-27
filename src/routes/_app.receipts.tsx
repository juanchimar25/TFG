import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  Plus, Trash2, CheckCircle2, Clock, XCircle, AlertCircle, Receipt,
  Loader2, ScanLine, PenLine, FileSearch, AlertTriangle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  getObligations, addObligation, deleteObligation, toggleObligation, extractObligation,
  computeEstado, formatObligationDate,
  type Obligation, type EstadoObligation,
} from "@/lib/api/obligations.functions";

export const Route = createFileRoute("/_app/receipts")({
  loader: async () => {
    const obligations = await getObligations();
    return { obligations };
  },
  component: Obligations,
});

function formatMonto(s: string): string {
  const n = parseFloat(s);
  return `ARS ${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function EstadoBadge({ estado }: { estado: EstadoObligation }) {
  const map: Record<EstadoObligation, { c: string; Icon: React.ElementType }> = {
    Próximo: { c: "bg-warning/15 text-warning",         Icon: Clock        },
    Urgente: { c: "bg-orange-100 text-orange-600",      Icon: AlertCircle  },
    Vencido: { c: "bg-destructive/10 text-destructive", Icon: XCircle      },
    Pagado:  { c: "bg-success/10 text-success",         Icon: CheckCircle2 },
  };
  const { c, Icon } = map[estado];
  return (
    <Badge variant="secondary" className={`gap-1 rounded-full ${c}`}>
      <Icon className="h-3 w-3" /> {estado}
    </Badge>
  );
}

function Obligations() {
  const { obligations } = Route.useLoaderData();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [open, setOpen]           = useState(false);
  const [step, setStep]           = useState<"choice" | "form" | "duplicate">("choice");
  const [saving, setSaving]       = useState(false);
  const [scanning, setScanning]   = useState(false);
  const [emisor, setEmisor]       = useState("");
  const [monto, setMonto]         = useState("");
  const [fecha, setFecha]         = useState("");
  const [dupMatch, setDupMatch]   = useState<Obligation | null>(null);
  const [dupSource, setDupSource] = useState<"ocr" | "manual">("ocr");
  const [forceAdd, setForceAdd]   = useState(false);

  const resetFields = () => { setEmisor(""); setMonto(""); setFecha(""); setDupMatch(null); setForceAdd(false); };
  const reset = () => { resetFields(); setStep("choice"); };
  const openManual = () => { resetFields(); setStep("form"); setOpen(true); };

  function findDuplicate(e: string, m: number, f: string): Obligation | null {
    const norm = (s: string) => s.toLowerCase().trim();
    return obligations.find((ob) =>
      norm(ob.emisor) === norm(e) &&
      Math.abs(parseFloat(ob.monto) - m) < 0.01 &&
      ob.fecha_vencimiento === f,
    ) ?? null;
  }

  function findDuplicateByAmountAndDate(m: number, f: string): Obligation | null {
    return obligations.find((ob) =>
      Math.abs(parseFloat(ob.monto) - m) < 0.01 &&
      ob.fecha_vencimiento === f,
    ) ?? null;
  }

  // ── OCR ──────────────────────────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("El archivo supera los 5 MB.");
      return;
    }

    resetFields();
    setStep("form");
    setScanning(true);
    setOpen(true);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]); // quitar "data:...;base64,"
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const result = await extractObligation({ data: { fileBase64: base64, mediaType: file.type } });

      const extractedEmisor = result.emisor ?? "";
      const extractedMonto  = result.monto != null ? String(result.monto) : "";
      const extractedFecha  = result.fecha_vencimiento ?? "";

      setEmisor(extractedEmisor);
      setMonto(extractedMonto);
      setFecha(extractedFecha);

      if (!result.emisor && !result.monto && !result.fecha_vencimiento) {
        toast.warning("No se pudieron extraer datos del documento. Completá los campos manualmente.");
        setStep("form");
      } else {
        const dup = result.monto != null && result.fecha_vencimiento
          ? findDuplicate(extractedEmisor, result.monto, extractedFecha)
          : null;
        if (dup) {
          setDupMatch(dup);
          setDupSource("ocr");
          setStep("duplicate");
        } else {
          toast.success("Datos extraídos. Verificá antes de guardar.");
          setStep("form");
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al procesar el archivo.");
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // ── Guardar ───────────────────────────────────────────────────────────────────

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) { toast.error("Ingresá un monto válido."); return; }
    if (!forceAdd) {
      const dup = findDuplicateByAmountAndDate(montoNum, fecha);
      if (dup) { setDupMatch(dup); setDupSource("manual"); setStep("duplicate"); return; }
    }
    setSaving(true);
    try {
      await addObligation({ data: { emisor, monto: montoNum, fecha_vencimiento: fecha } });
      await router.invalidate();
      setOpen(false);
      reset();
      toast.success("Obligación registrada.");
    } catch {
      toast.error("No se pudo guardar. Intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  // ── Acciones de tabla ─────────────────────────────────────────────────────────

  const handleDelete = async (ob: Obligation) => {
    try {
      await deleteObligation({ data: { id_obligacion: ob.id_obligacion } });
      await router.invalidate();
      toast.success(`${ob.emisor} eliminada.`);
    } catch {
      toast.error("No se pudo eliminar.");
    }
  };

  const handleToggle = async (ob: Obligation) => {
    try {
      await toggleObligation({ data: { id_obligacion: ob.id_obligacion, pagado: !ob.pagado } });
      await router.invalidate();
      toast.success(ob.pagado ? `${ob.emisor} marcada como pendiente.` : `${ob.emisor} marcada como pagada.`);
    } catch {
      toast.error("No se pudo actualizar.");
    }
  };

  const pendientes     = obligations.filter((o) => !o.pagado);
  const totalPendiente = pendientes.reduce((s, o) => s + parseFloat(o.monto), 0);

  return (
    <div className="space-y-6">

      {/* Input file oculto */}
      <input
        ref={fileRef}
        type="file"
        accept=".jpg,.jpeg,.png,.pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {pendientes.length} pendiente{pendientes.length !== 1 ? "s" : ""} ·{" "}
          <span className="font-medium text-foreground">
            ARS {totalPendiente.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
          </span>{" "}
          por vencer
        </p>
        <Button onClick={() => { reset(); setOpen(true); }} className="rounded-xl shadow-[var(--shadow-glow)]">
          <Plus className="mr-1 h-4 w-4" /> Nueva obligación
        </Button>
      </div>

      {/* Empty state */}
      {obligations.length === 0 && (
        <Card className="rounded-2xl border-dashed border-border p-10 text-center shadow-none">
          <Receipt className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium">No hay obligaciones registradas</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Subí una factura o cargá manualmente tus vencimientos.
          </p>
          <Button className="mt-4 rounded-xl" onClick={() => { reset(); setOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Nueva obligación
          </Button>
        </Card>
      )}

      {/* Tabla */}
      {obligations.length > 0 && (
        <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)]">
          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Emisor</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="hidden md:table-cell">Vencimiento</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {obligations.map((ob) => {
                  const estado = computeEstado(ob.fecha_vencimiento, ob.pagado);
                  return (
                    <TableRow key={ob.id_obligacion}>
                      <TableCell className="font-medium">{ob.emisor}</TableCell>
                      <TableCell className="text-right font-semibold">{formatMonto(ob.monto)}</TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {formatObligationDate(ob.fecha_vencimiento)}
                      </TableCell>
                      <TableCell><EstadoBadge estado={estado} /></TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => handleToggle(ob)}
                            title={ob.pagado ? "Marcar como pendiente" : "Marcar como pagada"}
                            className={`transition ${ob.pagado ? "text-success hover:text-success/70" : "text-muted-foreground hover:text-success"}`}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(ob)}
                            title="Eliminar"
                            className="text-destructive/70 transition hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva obligación</DialogTitle>
            <DialogDescription>
              {step === "choice"    ? "¿Cómo querés registrar la obligación?" :
             step === "duplicate" ? "Revisá antes de continuar." :
             "Verificá los datos y guardá."}
            </DialogDescription>
          </DialogHeader>

          {/* Paso 1: elegir método */}
          {step === "choice" && (
            <div className="mt-2 grid grid-cols-2 gap-3">
              <button
                onClick={openManual}
                className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-muted/30 p-5 text-center transition hover:border-primary/40 hover:bg-primary/5"
              >
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                  <PenLine className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Carga manual</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">Ingresá los datos vos mismo</div>
                </div>
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-muted/30 p-5 text-center transition hover:border-primary/40 hover:bg-primary/5"
              >
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                  <FileSearch className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Subir comprobante</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">JPG, PNG o PDF · máx. 5 MB</div>
                </div>
              </button>
            </div>
          )}

          {/* Paso 2: duplicado detectado */}
          {step === "duplicate" && dupMatch && (
            <div className="mt-2 space-y-4">
              <div className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                <div>
                  <p className="text-sm font-semibold">
                    {dupSource === "manual" ? "Posible duplicado detectado" : "Comprobante duplicado detectado"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Ya existe una obligación de <span className="font-medium">{dupMatch.emisor}</span> por{" "}
                    <span className="font-medium">
                      ARS {parseFloat(dupMatch.monto).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </span>{" "}
                    con vencimiento el{" "}
                    <span className="font-medium">{formatObligationDate(dupMatch.fecha_vencimiento)}</span>.
                    {dupSource === "manual"
                      ? " Verificá si ya tenés esta obligación registrada antes de continuar."
                      : " Cargarlo de nuevo distorsionaría tu análisis financiero."}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={reset}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1 rounded-xl"
                  onClick={() => { setDupMatch(null); setForceAdd(true); setStep("form"); }}
                >
                  Cargar de todas formas
                </Button>
              </div>
            </div>
          )}

          {/* Paso 3: formulario (manual o pre-llenado por OCR) */}
          {step === "form" && (
            scanning ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium">Analizando documento…</p>
                <p className="text-xs text-muted-foreground">Extrayendo emisor, monto y fecha de vencimiento.</p>
              </div>
            ) : (
              <form onSubmit={handleAdd} className="mt-2 space-y-3">
                <div>
                  <Label>Emisor</Label>
                  <Input
                    className="mt-1.5 h-10 rounded-xl"
                    placeholder="Ej: EPEC, Ecogas, Visa..."
                    value={emisor}
                    onChange={(e) => setEmisor(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Monto (ARS)</Label>
                  <Input
                    className="mt-1.5 h-10 rounded-xl"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Ej: 24580"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Fecha de vencimiento</Label>
                  <Input
                    className="mt-1.5 h-10 rounded-xl"
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => setStep("choice")}
                  >
                    Volver
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 rounded-xl shadow-[var(--shadow-glow)]"
                    disabled={saving}
                  >
                    {saving ? "Guardando…" : "Guardar obligación"}
                  </Button>
                </div>
              </form>
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
