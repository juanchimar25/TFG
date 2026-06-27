import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
  Plus, Wifi, WifiOff, Building2, Smartphone, RefreshCw, Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  getUserAccounts, unlinkAccount, syncAccounts,
  linkPrometeoAccount, submitPrometeoOtp,
  type Account,
} from "@/lib/api/accounts.functions";

export const Route = createFileRoute("/_app/accounts")({
  loader: async () => {
    const accounts = await getUserAccounts();
    return { accounts };
  },
  component: Accounts,
});

// ─── Utilidades ──────────────────────────────────────────────────────────────

function timeSince(iso: string | null): string {
  if (!iso) return "Sin sincronizar";
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} días`;
}

function isStale(iso: string | null): boolean {
  if (!iso) return true;
  return Date.now() - new Date(iso).getTime() > 10 * 60 * 1000;
}

function formatSaldo(saldo: string, moneda: string): string {
  const num = parseFloat(saldo);
  const formatted = Math.abs(num).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = num < 0 ? "- " : "";
  return `${sign}${moneda} ${formatted}`;
}

function entityIcon(tipo: string) {
  return tipo === "Billetera Virtual" ? Smartphone : Building2;
}

const BRAND_MAP: Record<string, string> = {
  "Mercado Pago":    "bg-cyan-100 text-cyan-700",
  "Ualá":            "bg-violet-100 text-violet-600",
  "Personal Pay":    "bg-orange-100 text-orange-600",
  "Lemon Cash":      "bg-yellow-100 text-yellow-600",
  "Naranja X":       "bg-orange-100 text-orange-600",
  "Banco Galicia":   "bg-orange-100 text-orange-600",
  "Banco Santander": "bg-red-100 text-red-600",
  "BBVA Argentina":  "bg-blue-100 text-blue-600",
  "Banco Macro":     "bg-amber-100 text-amber-600",
  "Banco Nación":    "bg-sky-100 text-sky-700",
  "Bancor":          "bg-rose-100 text-rose-700",
  "Brubank":         "bg-indigo-100 text-indigo-600",
};

function entityBrand(nombre: string): string {
  return BRAND_MAP[nombre] ?? "bg-muted text-muted-foreground";
}

// ─── Providers disponibles ────────────────────────────────────────────────────

const PROVIDERS = [
  { value: "galicia",       label: "Banco Galicia",   group: "Bancos" },
  { value: "santander",     label: "Banco Santander", group: "Bancos" },
  { value: "bbva",          label: "BBVA Argentina",  group: "Bancos" },
  { value: "macro",         label: "Banco Macro",     group: "Bancos" },
  { value: "nacion",        label: "Banco Nación",    group: "Bancos" },
  { value: "bancor",        label: "Bancor",          group: "Bancos" },
  { value: "brubank",       label: "Brubank",         group: "Bancos" },
  { value: "mercadopago",   label: "Mercado Pago",    group: "Billeteras" },
  { value: "uala",          label: "Ualá",            group: "Billeteras" },
  { value: "personal-pay",  label: "Personal Pay",    group: "Billeteras" },
  { value: "lemoncash",     label: "Lemon Cash",      group: "Billeteras" },
  { value: "naranjax",      label: "Naranja X",       group: "Billeteras" },
];

// ─── Componente principal ─────────────────────────────────────────────────────

function Accounts() {
  const { accounts } = Route.useLoaderData();
  const router = useRouter();

  // Unlink
  const [unlinkTarget, setUnlinkTarget] = useState<Account | null>(null);

  // Sync
  const [syncing, setSyncing] = useState(false);

  // Link dialog
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkStep, setLinkStep] = useState<"credentials" | "otp">("credentials");
  const [linkLoading, setLinkLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [linkUsername, setLinkUsername] = useState("");
  const [linkPassword, setLinkPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpContext, setOtpContext] = useState("");
  const [otpField, setOtpField] = useState("otp");
  const [pendingKey, setPendingKey] = useState("");

  const staleAccounts = accounts.filter((a) => isStale(a.ultima_sincronizacion));

  const resetLinkForm = () => {
    setLinkStep("credentials");
    setSelectedProvider("");
    setLinkUsername("");
    setLinkPassword("");
    setOtpCode("");
    setOtpContext("");
    setOtpField("otp");
    setPendingKey("");
  };

  const handleLinkCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkLoading(true);
    try {
      const result = await linkPrometeoAccount({
        data: { provider: selectedProvider, username: linkUsername, password: linkPassword },
      });
      if (result.status === "interaction_required") {
        setPendingKey(result.key);
        setOtpContext(result.context);
        setOtpField(result.field);
        setLinkStep("otp");
      } else {
        await router.invalidate();
        setLinkOpen(false);
        resetLinkForm();
        toast.success(
          `${result.imported} ${result.imported === 1 ? "cuenta vinculada" : "cuentas vinculadas"} correctamente.`,
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo conectar. Intentá de nuevo.");
    } finally {
      setLinkLoading(false);
    }
  };

  const handleLinkOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkLoading(true);
    try {
      const result = await submitPrometeoOtp({
        data: { key: pendingKey, field: otpField, value: otpCode, provider: selectedProvider },
      });
      await router.invalidate();
      setLinkOpen(false);
      resetLinkForm();
      toast.success(
        `${result.imported} ${result.imported === 1 ? "cuenta vinculada" : "cuentas vinculadas"} correctamente.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Código incorrecto. Intentá de nuevo.");
    } finally {
      setLinkLoading(false);
    }
  };

  const handleSync = async () => {
    if (accounts.length === 0) return;
    setSyncing(true);
    try {
      const result = await syncAccounts();
      await router.invalidate();
      toast.success(`${result.synced} ${result.synced === 1 ? "cuenta sincronizada" : "cuentas sincronizadas"} correctamente.`);
    } catch {
      toast.error("No se pudo sincronizar. Reintentá en unos segundos.");
    } finally {
      setSyncing(false);
    }
  };

  const handleUnlink = async () => {
    if (!unlinkTarget) return;
    try {
      await unlinkAccount({ data: { id_cuenta: unlinkTarget.id_cuenta } });
      await router.invalidate();
      toast.success(`${unlinkTarget.nombre_entidad} desvinculada.`);
    } catch {
      toast.error("No se pudo desvincular la cuenta.");
    } finally {
      setUnlinkTarget(null);
    }
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {accounts.length} {accounts.length === 1 ? "entidad sincronizada" : "entidades sincronizadas"}
          {accounts.length > 0 && " · última actualización "}
          {accounts.length > 0 && timeSince(
            accounts.reduce((latest, a) => {
              if (!a.ultima_sincronizacion) return latest;
              if (!latest) return a.ultima_sincronizacion;
              return a.ultima_sincronizacion > latest ? a.ultima_sincronizacion : latest;
            }, null as string | null),
          )}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={handleSync}
            disabled={syncing || accounts.length === 0}
          >
            <RefreshCw className={`mr-1 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando…" : "Sincronizar todo"}
          </Button>
          <Button onClick={() => setLinkOpen(true)} className="rounded-xl shadow-[var(--shadow-glow)]">
            <Plus className="mr-1 h-4 w-4" /> Vincular cuenta
          </Button>
        </div>
      </div>

      {/* Alerta de cuentas desactualizadas */}
      {staleAccounts.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-4">
          <WifiOff className="mt-0.5 h-5 w-5 text-warning" />
          <div className="flex-1">
            <div className="text-sm font-semibold">
              {staleAccounts.length === 1
                ? `Conexión desactualizada con ${staleAccounts[0].nombre_entidad}`
                : `${staleAccounts.length} cuentas con saldo desactualizado`}
            </div>
            <p className="text-xs text-muted-foreground">
              Mantenemos el último saldo conocido. Usá "Sincronizar todo" para actualizar.
            </p>
          </div>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={handleSync} disabled={syncing}>
            Reintentar
          </Button>
        </div>
      )}

      {/* Empty state */}
      {accounts.length === 0 && (
        <Card className="rounded-2xl border-dashed border-border p-10 text-center shadow-none">
          <Building2 className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium">No tenés cuentas vinculadas</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Vincular tu primera cuenta activa la sincronización automática.
          </p>
          <Button className="mt-4 rounded-xl" onClick={() => setLinkOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Vincular cuenta
          </Button>
        </Card>
      )}

      {/* Grid de cuentas */}
      {accounts.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((a) => {
            const Icon = entityIcon(a.tipo_entidad);
            const stale = isStale(a.ultima_sincronizacion);
            const negative = parseFloat(a.saldo_actual) < 0;

            return (
              <Card
                key={a.id_cuenta}
                className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:border-primary/30"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`grid h-11 w-11 place-items-center rounded-xl ${entityBrand(a.nombre_entidad)}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{a.nombre_entidad}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.tipo_cuenta} · {a.ultimos_digitos ? `•••• ${a.ultimos_digitos}` : "—"}
                      </div>
                    </div>
                  </div>
                  {stale ? (
                    <Badge variant="secondary" className="gap-1 rounded-full bg-warning/15 text-warning">
                      <WifiOff className="h-3 w-3" /> Caché
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1 rounded-full bg-success/10 text-success">
                      <Wifi className="h-3 w-3" /> Activa
                    </Badge>
                  )}
                </div>

                <div className="mt-5">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Saldo actual</div>
                  <div className={`mt-1 text-2xl font-bold tracking-tight ${negative ? "text-destructive" : ""}`}>
                    {formatSaldo(a.saldo_actual, a.moneda)}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                  <span>Sincronizado {timeSince(a.ultima_sincronizacion)}</span>
                  <button
                    onClick={() => setUnlinkTarget(a)}
                    className="text-destructive/70 transition hover:text-destructive"
                    title="Desvincular cuenta"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog: Vincular cuenta */}
      <Dialog open={linkOpen} onOpenChange={(v) => { setLinkOpen(v); if (!v) resetLinkForm(); }}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Vincular cuenta</DialogTitle>
            <DialogDescription>
              Vinculá automáticamente tus cuentas bancarias.
            </DialogDescription>
          </DialogHeader>

          {linkStep === "credentials" && (
            <form onSubmit={handleLinkCredentials} className="mt-2 space-y-3">
              <div>
                <Label>Banco o billetera</Label>
                <select
                  className="mt-1.5 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  required
                >
                  <option value="">Seleccioná una entidad…</option>
                  <optgroup label="Bancos">
                    {PROVIDERS.filter((p) => p.group === "Bancos").map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Billeteras virtuales">
                    {PROVIDERS.filter((p) => p.group === "Billeteras").map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <Label>Usuario de homebanking</Label>
                <Input
                  className="mt-1.5 h-10 rounded-xl"
                  autoComplete="username"
                  value={linkUsername}
                  onChange={(e) => setLinkUsername(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label>Contraseña</Label>
                <Input
                  type="password"
                  className="mt-1.5 h-10 rounded-xl"
                  autoComplete="current-password"
                  value={linkPassword}
                  onChange={(e) => setLinkPassword(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full rounded-xl shadow-[var(--shadow-glow)]" disabled={linkLoading}>
                {linkLoading ? "Conectando…" : "Conectar"}
              </Button>
            </form>
          )}

          {linkStep === "otp" && (
            <form onSubmit={handleLinkOtp} className="mt-2 space-y-3">
              <p className="text-sm text-muted-foreground">
                {otpContext || "Ingresá el código de verificación que recibiste."}
              </p>
              <div>
                <Label>Código de verificación</Label>
                <Input
                  className="mt-1.5 h-10 rounded-xl tracking-widest"
                  placeholder="000000"
                  maxLength={8}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={() => setLinkStep("credentials")}
                  disabled={linkLoading}
                >
                  Volver
                </Button>
                <Button type="submit" className="flex-1 rounded-xl" disabled={linkLoading}>
                  {linkLoading ? "Verificando…" : "Verificar"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* AlertDialog: Desvincular cuenta */}
      <AlertDialog open={!!unlinkTarget} onOpenChange={(v) => { if (!v) setUnlinkTarget(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desvincular {unlinkTarget?.nombre_entidad}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán el saldo y el historial de movimientos de esta cuenta. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleUnlink}
            >
              Desvincular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
