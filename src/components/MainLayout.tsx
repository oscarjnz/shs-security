import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { UserButton, useClerk } from "@clerk/react";
import { useProfile } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { hasPermission } from "@/lib/auth";
import type { SectionKey } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Network, Monitor, ShieldAlert, Bug, ScrollText,
  Brain, FileBarChart, Settings, Users, Bell, LogOut, ScanSearch, History, Activity, Menu, X,
  BookOpen, Flame, Globe, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Logo } from "@/components/Logo";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LocalAgentDetector } from "@/components/scanner/LocalAgentDetector";
import { OnboardingWizard } from "@/components/scanner/OnboardingWizard";

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  section: SectionKey;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, section: "dashboard" },
  { label: "Red", path: "/network", icon: Network, section: "network" },
  { label: "Dispositivos", path: "/devices", icon: Monitor, section: "devices" },
  { label: "Amenazas", path: "/threats", icon: ShieldAlert, section: "threats" },
  { label: "Vulnerabilidades", path: "/vulnerabilities", icon: Bug, section: "vulnerabilities" },
  { label: "OWASP & ACi", path: "/owasp", icon: BookOpen, section: "dashboard" },
  { label: "Explotadas (CISA KEV)", path: "/kev", icon: Flame, section: "dashboard" },
  { label: "Geolocalización", path: "/geo", icon: Globe, section: "dashboard" },
  { label: "Scanner", path: "/scan", icon: ScanSearch, section: "network" },
  { label: "Historial Scans", path: "/scan/history", icon: History, section: "network" },
  { label: "Pulso", path: "/pulse", icon: Activity, section: "network" },
  { label: "Escáneres", path: "/settings/scanners", icon: Monitor, section: "network" },
  { label: "Logs", path: "/logs", icon: ScrollText, section: "logs" },
  { label: "ACi (asistente)", path: "/ai-analysis", icon: Brain, section: "ai_analysis" },
  { label: "Reportes", path: "/reports", icon: FileBarChart, section: "reports" },
  { label: "Configuración", path: "/settings", icon: Settings, section: "settings" },
];

const COLLAPSE_KEY = "sss-sidebar-collapsed";

/** Un item del sidebar. Cuando el riel esta colapsado muestra solo el icono y
 *  un tooltip a la derecha con el label, para no perder contexto. */
function SidebarLink({
  to, icon: Icon, label, collapsed, onNavigate,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const link = (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "group/nav relative flex items-center gap-3 rounded-md py-2 text-sm font-medium outline-none transition-[background-color,color,box-shadow] duration-150 ease-out-quart focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
          collapsed ? "justify-center px-0" : "px-3",
          isActive
            ? "bg-primary/10 text-primary shadow-[inset_2px_0_0_0_hsl(var(--primary)),inset_0_1px_0_0_hsl(210_40%_98%/0.04)]"
            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );

  if (!collapsed) return link;

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" className="font-medium">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function MainLayout() {
  const { profile, permissions, isAdmin } = useProfile();
  const { signOut } = useClerk();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  });

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  const visibleItems = NAV_ITEMS.filter((item) =>
    hasPermission(permissions, item.section, "view"),
  );

  const closeMobile = () => setSidebarOpen(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-[2px] animate-in fade-in-0 duration-200 lg:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-sidebar transition-[transform,width] duration-300 ease-drawer lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          collapsed ? "lg:w-16" : "lg:w-64",
        )}
      >
        <div className={cn("flex h-16 items-center gap-3 border-b border-border", collapsed ? "justify-center px-2" : "px-6")}>
          <Logo className="h-9 w-9 shrink-0" />
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-sm font-bold tracking-[-0.02em] text-foreground">S.S.S</h1>
              <p className="text-[10px] tracking-[0.04em] text-muted-foreground">Security Smart Services</p>
            </div>
          )}
          <button
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground outline-none transition-[background-color,color,transform] duration-150 ease-out-quart hover:bg-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 active:scale-95 lg:hidden"
            onClick={closeMobile}
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
          <ul className="space-y-1">
            {visibleItems.map((item) => (
              <li key={item.path}>
                <SidebarLink
                  to={item.path}
                  icon={item.icon}
                  label={item.label}
                  collapsed={collapsed}
                  onNavigate={closeMobile}
                />
              </li>
            ))}

            {isAdmin && (
              <li>
                <SidebarLink
                  to="/settings/users"
                  icon={Users}
                  label="Usuarios"
                  collapsed={collapsed}
                  onNavigate={closeMobile}
                />
              </li>
            )}
          </ul>
        </nav>

        <div className={cn("border-t border-border", collapsed ? "p-2" : "p-4")}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.3)]">
                {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <ConfirmDialog
                title="¿Cerrar sesión?"
                description={
                  <span>
                    Saldrás de S.S.S y deberás volver a iniciar sesión la próxima vez.
                    Tus datos (escaneos, dispositivos, reportes) siguen guardados en tu cuenta.
                  </span>
                }
                confirmLabel="Sí, cerrar sesión"
                cancelLabel="Cancelar"
                onConfirm={handleSignOut}
                trigger={
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label="Cerrar sesión">
                        <LogOut className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Cerrar sesión</TooltipContent>
                  </Tooltip>
                }
              />
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.3)]">
                  {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {profile?.full_name || "Usuario"}
                  </p>
                  <p className="text-[10px] capitalize text-muted-foreground">
                    {profile?.role || "-"}
                  </p>
                </div>
              </div>
              <ConfirmDialog
                title="¿Cerrar sesión?"
                description={
                  <span>
                    Saldrás de S.S.S y deberás volver a iniciar sesión la próxima vez.
                    Tus datos (escaneos, dispositivos, reportes) siguen guardados en tu cuenta.
                  </span>
                }
                confirmLabel="Sí, cerrar sesión"
                cancelLabel="Cancelar"
                onConfirm={handleSignOut}
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-muted-foreground hover:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Cerrar sesión
                  </Button>
                }
              />
            </>
          )}

          {/* Toggle del riel: solo en desktop (en movil el sidebar es un drawer) */}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className={cn(
              "mt-2 hidden h-8 items-center gap-2 rounded-md text-xs font-medium text-muted-foreground outline-none transition-[background-color,color] duration-150 ease-out-quart hover:bg-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 lg:flex",
              collapsed ? "w-8 justify-center px-0" : "w-full justify-start px-2",
            )}
            aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
            title={collapsed ? "Expandir menú" : "Contraer menú"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && <span>Contraer menú</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center gap-4 border-b border-border bg-background/60 px-4 backdrop-blur-md lg:px-6">
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground outline-none transition-[background-color,color,transform] duration-150 ease-out-quart hover:bg-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 active:scale-95 lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <UserButton />
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => navigate("/notifications")}
            aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ""}`}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground shadow-[0_0_0_2px_hsl(var(--background)),0_0_12px_-2px_hsl(142_71%_45%/0.6)] animate-in zoom-in-50 duration-200 ease-spring">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      {/* Detector silencioso: si hay un agente local de otra cuenta, ofrece importarlo.
          Si no hay agente o ya es de esta cuenta, no muestra nada. Una sola vez por userId. */}
      <LocalAgentDetector />

      {/* Asistente de bienvenida: si el usuario no tiene ningun escaner, lo guia
          a instalar su agente. Reaparece hasta que tenga uno; no molesta si ya lo tiene. */}
      <OnboardingWizard />
    </div>
  );
}
