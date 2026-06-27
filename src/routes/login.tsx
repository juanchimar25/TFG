import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Mail, Lock, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PrimusLogo } from "@/components/PrimusLogo";
import { toast } from "sonner";
import { registerUser, loginUser } from "@/lib/api/auth.functions";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Ingresar — Primus" }] }),
  component: Auth,
});

type Mode = "login" | "register" | "recover";

const ERROR_MESSAGES: Record<string, string> = {
  EMAIL_TAKEN: "Este email ya está registrado. Probá iniciar sesión.",
  INVALID_CREDENTIALS: "Correo o clave incorrectos.",
  ACCOUNT_LOCKED: "Cuenta bloqueada por múltiples intentos fallidos. Intentá en 15 minutos.",
};

function parseServerError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  for (const [key, label] of Object.entries(ERROR_MESSAGES)) {
    if (msg.includes(key)) return label;
  }
  return "Ocurrió un error inesperado. Intentá de nuevo.";
}

function Auth() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const navigate = useNavigate();

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passLen = password.length >= 8;
  const showEmailErr = touched.email && !emailValid;
  const showPassErr = touched.password && mode === "register" && !passLen;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });

    if (!email) return toast.error("El email es requerido.");
    if (!emailValid) return toast.error("Email inválido.");

    if (mode === "recover") {
      toast.success("Te enviamos un enlace de recuperación.");
      setMode("login");
      return;
    }

    if (!password) return toast.error("La contraseña es requerida.");
    if (mode === "register" && !passLen) return toast.error("La contraseña debe tener al menos 8 caracteres.");

    setLoading(true);
    try {
      if (mode === "register") {
        await registerUser({ data: { email, password } });
        toast.success("Cuenta creada. ¡Bienvenido!");
      } else {
        await loginUser({ data: { email, password } });
        toast.success("Bienvenido de vuelta.");
      }
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(parseServerError(err));
    } finally {
      setLoading(false);
    }
  };

  const titles = {
    login: { h: "Ingresá a tu Ecosistema", s: "Tu Ecosistema te espera." },
    register: { h: "Activá tu Ecosistema", s: "Empezá gratis en 2 minutos." },
    recover: { h: "Recuperar contraseña", s: "Te enviaremos un enlace seguro." },
  }[mode];

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* LEFT - form */}
      <div className="flex flex-col px-6 py-8 md:px-12">
        <div className="flex items-center justify-between">
          <PrimusLogo />
          <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Volver
          </Link>
        </div>

        <div className="my-auto mx-auto w-full max-w-sm py-10">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{titles.h}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{titles.s}</p>

          {/* Tabs */}
          <div className="mt-6 inline-flex rounded-xl bg-muted p-1 text-sm">
            {(["login", "register"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-lg px-4 py-1.5 font-medium transition ${
                  mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                {m === "login" ? "Iniciar sesión" : "Registrarse"}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative mt-1.5">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  placeholder="tu@email.com"
                  className={`h-11 rounded-xl pl-9 ${showEmailErr ? "border-destructive" : ""}`}
                />
              </div>
              {showEmailErr && (
                <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" /> Email inválido o requerido.
                </p>
              )}
            </div>

            {mode !== "recover" && (
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Contraseña</Label>
                  {mode === "login" && (
                    <button type="button" onClick={() => setMode("recover")} className="text-xs font-medium text-primary hover:underline">
                      Olvidé mi contraseña
                    </button>
                  )}
                </div>
                <div className="relative mt-1.5">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                    placeholder="••••••••"
                    className={`h-11 rounded-xl pl-9 pr-10 ${showPassErr ? "border-destructive" : ""}`}
                  />
                  <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {mode === "register" && (
                  <p className={`mt-1 flex items-center gap-1 text-xs ${passLen ? "text-success" : showPassErr ? "text-destructive" : "text-muted-foreground"}`}>
                    {passLen ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                    Mínimo 8 caracteres (mayúscula, minúscula, número y carácter especial).
                  </p>
                )}
              </div>
            )}

            <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl shadow-[var(--shadow-glow)]">
              {loading
                ? "Procesando…"
                : mode === "login"
                  ? "Ingresar al Ecosistema"
                  : mode === "register"
                    ? "Crear cuenta gratis"
                    : "Enviar enlace"}
            </Button>

            {mode === "recover" && (
              <button type="button" onClick={() => setMode("login")} className="block w-full text-center text-xs text-muted-foreground hover:text-foreground">
                Volver a iniciar sesión
              </button>
            )}
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Al continuar aceptás los Términos y Política de Privacidad de Primus.
          </p>
        </div>
      </div>

      {/* RIGHT - visual */}
      <div className="relative hidden overflow-hidden bg-[image:var(--gradient-primary)] lg:block">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute -left-20 top-1/3 h-80 w-80 rounded-full bg-white/30 blur-3xl" />
          <div className="absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-white/20 blur-3xl" />
        </div>
        <div className="relative flex h-full flex-col justify-between p-12 text-primary-foreground">
          <blockquote className="max-w-md text-2xl font-semibold leading-snug">
            "Pasé de revisar 6 apps por día a tener todo en un solo tablero. Primus me devolvió 4 horas por semana."
          </blockquote>
          <div className="space-y-2">
            <div className="text-sm font-medium">María González</div>
            <div className="text-xs opacity-80">Usuaria desde 2024 · Cash flow optimizado +32%</div>
          </div>
        </div>
      </div>
    </div>
  );
}
