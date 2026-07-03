import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthenticateWithRedirectCallback } from "@clerk/react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProfileProvider } from "@/contexts/AuthContext";
import { ScanProvider } from "@/contexts/ScanContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { MainLayout } from "@/components/MainLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import { LandingPage } from "@/pages/LandingPage";
import { DemoPage } from "@/pages/DemoPage";
import { LoginPage } from "@/pages/LoginPage";
import { SignUpPage } from "@/pages/SignUpPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { NetworkOverviewPage } from "@/pages/NetworkOverviewPage";
import { ConnectedDevicesPage } from "@/pages/ConnectedDevicesPage";
import { ThreatDetectionPage } from "@/pages/ThreatDetectionPage";
import { VulnerabilityScannerPage } from "@/pages/VulnerabilityScannerPage";
import { VulnerabilityDetailPage } from "@/pages/VulnerabilityDetailPage";
import { OwaspPage } from "@/pages/OwaspPage";
import { KevCatalogPage } from "@/pages/KevCatalogPage";
import { ActivityLogsPage } from "@/pages/ActivityLogsPage";
import { AIAnalysisPage } from "@/pages/AIAnalysisPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { UsersPage } from "@/pages/settings/UsersPage";
import { ScannerAgentsPage } from "@/pages/ScannerAgentsPage";
import { NotificationsPage } from "@/pages/NotificationsPage";
import { ScanPage } from "@/pages/ScanPage";
import { ScanHistoryPage } from "@/pages/ScanHistoryPage";
import { PulsePage } from "@/pages/PulsePage";
import { GeoLocationPage } from "@/pages/GeoLocationPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ProfileProvider>
        <ScanProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public routes (no auth required) */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/demo" element={<DemoPage />} />
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
          </BrowserRouter>
        </TooltipProvider>
        </ScanProvider>
      </ProfileProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
