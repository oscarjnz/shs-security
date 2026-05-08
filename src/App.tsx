import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { MainLayout } from "@/components/MainLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import { LoginPage } from "@/pages/LoginPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { NetworkOverviewPage } from "@/pages/NetworkOverviewPage";
import { ConnectedDevicesPage } from "@/pages/ConnectedDevicesPage";
import { ThreatDetectionPage } from "@/pages/ThreatDetectionPage";
import { VulnerabilityScannerPage } from "@/pages/VulnerabilityScannerPage";
import { ActivityLogsPage } from "@/pages/ActivityLogsPage";
import { AIAnalysisPage } from "@/pages/AIAnalysisPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { UsersPage } from "@/pages/settings/UsersPage";
import { NotificationsPage } from "@/pages/NotificationsPage";
import { ScanPage } from "@/pages/ScanPage";
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
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              <Route element={<ProtectedRoute />}>
                <Route element={<MainLayout />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/network" element={<NetworkOverviewPage />} />
                  <Route path="/devices" element={<ConnectedDevicesPage />} />
                  <Route path="/threats" element={<ThreatDetectionPage />} />
                  <Route path="/vulnerabilities" element={<VulnerabilityScannerPage />} />
                  <Route path="/logs" element={<ActivityLogsPage />} />
                  <Route path="/ai-analysis" element={<AIAnalysisPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/scan" element={<ScanPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/settings/users" element={<UsersPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                </Route>
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
