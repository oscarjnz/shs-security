import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthenticateWithRedirectCallback } from "@clerk/react";
import { Suspense, lazy } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProfileProvider } from "@/contexts/AuthContext";
import { ScanProvider } from "@/contexts/ScanContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";

/*
 * QUE ENTRA EN EL BUNDLE INICIAL Y QUE NO (2026-08-24)
 *
 * Antes las 25 paginas se importaban de forma directa, asi que quien abria la
 * portada descargaba tambien el panel entero: un solo chunk de 1.49 MB. Hasta
 * que ese archivo no terminaba de bajar y ejecutarse, React no montaba y el
 * visitante seguia viendo el HTML estatico del prerender. Eran segundos.
 *
 * La regla ahora: las paginas PUBLICAS (las mismas que prerenderiza
 * src/prerender/routes.ts) se importan de forma directa, porque son lo primero
 * que hay que pintar y un segundo viaje al servidor solo alargaria la espera.
 * Todo lo que vive detras del login se carga bajo demanda con lazy: nadie que
 * llegue por Google paga el peso del dashboard.
 *
 * Al agregar una pagina nueva: publica -> import normal; detras del login ->
 * lazy, como las de abajo.
 */
import { LandingPage } from "@/pages/LandingPage";
import { DemoPage } from "@/pages/DemoPage";
import { GuidesIndexPage } from "@/pages/GuidesIndexPage";
import { GuideArticlePage } from "@/pages/GuideArticlePage";
import { LoginPage } from "@/pages/LoginPage";
import { SignUpPage } from "@/pages/SignUpPage";

const ResetPasswordPage = lazy(() =>
  import("@/pages/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage })),
);
const MainLayout = lazy(() =>
  import("@/components/MainLayout").then((m) => ({ default: m.MainLayout })),
);
const DashboardPage = lazy(() =>
  import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const NetworkOverviewPage = lazy(() =>
  import("@/pages/NetworkOverviewPage").then((m) => ({ default: m.NetworkOverviewPage })),
);
const ConnectedDevicesPage = lazy(() =>
  import("@/pages/ConnectedDevicesPage").then((m) => ({ default: m.ConnectedDevicesPage })),
);
const ThreatDetectionPage = lazy(() =>
  import("@/pages/ThreatDetectionPage").then((m) => ({ default: m.ThreatDetectionPage })),
);
const VulnerabilityScannerPage = lazy(() =>
  import("@/pages/VulnerabilityScannerPage").then((m) => ({
    default: m.VulnerabilityScannerPage,
  })),
);
const VulnerabilityDetailPage = lazy(() =>
  import("@/pages/VulnerabilityDetailPage").then((m) => ({
    default: m.VulnerabilityDetailPage,
  })),
);
const OwaspPage = lazy(() =>
  import("@/pages/OwaspPage").then((m) => ({ default: m.OwaspPage })),
);
const KevCatalogPage = lazy(() =>
  import("@/pages/KevCatalogPage").then((m) => ({ default: m.KevCatalogPage })),
);
const ActivityLogsPage = lazy(() =>
  import("@/pages/ActivityLogsPage").then((m) => ({ default: m.ActivityLogsPage })),
);
const AIAnalysisPage = lazy(() =>
  import("@/pages/AIAnalysisPage").then((m) => ({ default: m.AIAnalysisPage })),
);
const ReportsPage = lazy(() =>
  import("@/pages/ReportsPage").then((m) => ({ default: m.ReportsPage })),
);
const SettingsPage = lazy(() =>
  import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const UsersPage = lazy(() =>
  import("@/pages/settings/UsersPage").then((m) => ({ default: m.UsersPage })),
);
const ScannerAgentsPage = lazy(() =>
  import("@/pages/ScannerAgentsPage").then((m) => ({ default: m.ScannerAgentsPage })),
);
const NotificationsPage = lazy(() =>
  import("@/pages/NotificationsPage").then((m) => ({ default: m.NotificationsPage })),
);
const ScanPage = lazy(() =>
  import("@/pages/ScanPage").then((m) => ({ default: m.ScanPage })),
);
const ScanHistoryPage = lazy(() =>
  import("@/pages/ScanHistoryPage").then((m) => ({ default: m.ScanHistoryPage })),
);
const PulsePage = lazy(() =>
  import("@/pages/PulsePage").then((m) => ({ default: m.PulsePage })),
);
const GeoLocationPage = lazy(() =>
  import("@/pages/GeoLocationPage").then((m) => ({ default: m.GeoLocationPage })),
);
const NotFound = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Lo que se ve mientras baja el chunk de una pagina cargada bajo demanda. Es
 * deliberadamente sobrio y del color del sitio: nunca debe leerse como un
 * error ni como una pagina a medio pintar.
 */
function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cyber-dark">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-cyber-green"
        role="status"
        aria-label="Cargando"
      />
    </div>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ProfileProvider>
        <ScanProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* Public routes (no auth required) */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/demo" element={<DemoPage />} />
              <Route path="/guias" element={<GuidesIndexPage />} />
              <Route path="/guias/:slug" element={<GuideArticlePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignUpPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/sso-callback" element={<AuthenticateWithRedirectCallback />} />

              <Route element={<ProtectedRoute />}>
                <Route element={<MainLayout />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/network" element={<NetworkOverviewPage />} />
                  <Route path="/devices" element={<ConnectedDevicesPage />} />
                  <Route path="/threats" element={<ThreatDetectionPage />} />
                  <Route path="/vulnerabilities" element={<VulnerabilityScannerPage />} />
                  <Route path="/vulnerability/:cveId" element={<VulnerabilityDetailPage />} />
                  <Route path="/owasp" element={<OwaspPage />} />
                  <Route path="/kev" element={<KevCatalogPage />} />
                  <Route path="/logs" element={<ActivityLogsPage />} />
                  <Route path="/ai-analysis" element={<AIAnalysisPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/scan" element={<ScanPage />} />
                  <Route path="/scan/history" element={<ScanHistoryPage />} />
                  <Route path="/pulse" element={<PulsePage />} />
                  <Route path="/geo" element={<GeoLocationPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/settings/users" element={<UsersPage />} />
                  <Route path="/settings/scanners" element={<ScannerAgentsPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                </Route>
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
        </ScanProvider>
      </ProfileProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
