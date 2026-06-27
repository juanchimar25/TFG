import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { LogOut } from "lucide-react";
import { getCurrentUser, logoutUser } from "@/lib/api/auth.functions";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const user = await getCurrentUser();
    if (!user) throw redirect({ to: "/login" });
    return { user };
  },
  component: AppLayout,
});

const titles: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Dashboard", subtitle: "Vista consolidada de tu salud financiera" },
  "/accounts": { title: "Cuentas Vinculadas", subtitle: "Bancos y billeteras virtuales sincronizados" },
  "/receipts": { title: "Obligaciones", subtitle: "Ingesta documental inteligente" },
  "/cashflow": { title: "Proyecciones de Cash Flow", subtitle: "Liquidez proyectada en tiempo real" },
  "/investments": { title: "Comparador de Inversiones", subtitle: "Ranking objetivo de alternativas del mercado" },
  "/loans": { title: "Comparador de Financiaciones", subtitle: "Crédito ordenado por CFT" },
  "/faq":   { title: "Glosario", subtitle: "Conceptos financieros explicados de forma simple" },
};

function AppLayout() {
  const { user } = Route.useRouteContext();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const meta = titles[pathname] ?? { title: "Primus", subtitle: "" };
  const navigate = useNavigate();

  const initials = user.email.slice(0, 2).toUpperCase();

  const handleLogout = async () => {
    await logoutUser();
    toast.success("Sesión cerrada.");
    navigate({ to: "/login" });
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
            <SidebarTrigger />
            <div className="hidden flex-col md:flex">
              <h1 className="text-base font-semibold leading-tight">{meta.title}</h1>
              <p className="text-xs text-muted-foreground">{meta.subtitle}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div
                title={user.email}
                className="grid h-9 w-9 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-sm font-semibold text-primary-foreground"
              >
                {initials}
              </div>
              <button
                onClick={handleLogout}
                title="Cerrar sesión"
                className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-card transition hover:bg-muted"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </header>
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
