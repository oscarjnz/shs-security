import { useState, useEffect, useCallback } from "react";
import { Settings, Loader2, Mail, Bell, Palette } from "lucide-react";
import { supabase, AGENT_URL } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
interface EmailConfig {
  id: string;
  user_id: string;
  notify_threats: boolean;
  notify_vulns: boolean;
  notify_reports: boolean;
  recipient_email: string | null;
}

interface UserPreferences {
  id: string;
  user_id: string;
  compact_mode: boolean;
}

export function SettingsPage() {
  const { user } = useAuth();

  // --- Notifications state ---
  const [emailConfig, setEmailConfig] = useState<EmailConfig | null>(null);
  const [loadingEmail, setLoadingEmail] = useState(true);
  const [savingEmail, setSavingEmail] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);

  // --- Preferences state ---
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Fetch email config
  const fetchEmailConfig = useCallback(async () => {
    if (!user) return;
    setLoadingEmail(true);

    const { data, error } = await supabase
      .from("email_config")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      toast({
        title: "Error al cargar configuracion de email",
        variant: "destructive",
      });
      setLoadingEmail(false);
      return;
    }

    if (data) {
      setEmailConfig(data as EmailConfig);
    } else {
      // Create default config
      const defaultConfig = {
        user_id: user.id,
        notify_threats: true,
        notify_vulns: true,
        notify_reports: true,
        recipient_email: user.email ?? null,
      };

      const { data: created, error: createErr } = await supabase
        .from("email_config")
        .insert(defaultConfig)
        .select()
        .single();

      if (!createErr && created) {
        setEmailConfig(created as EmailConfig);
      }
    }

    setLoadingEmail(false);
  }, [user]);

  // Fetch preferences
  const fetchPreferences = useCallback(async () => {
    if (!user) return;
    setLoadingPrefs(true);

    const { data, error } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      toast({
        title: "Error al cargar preferencias",
        variant: "destructive",
      });
      setLoadingPrefs(false);
      return;
    }

    if (data) {
      setPrefs(data as UserPreferences);
    } else {
      const { data: created, error: createErr } = await supabase
        .from("user_preferences")
        .insert({ user_id: user.id, compact_mode: false })
        .select()
        .single();

      if (!createErr && created) {
        setPrefs(created as UserPreferences);
      }
    }

    setLoadingPrefs(false);
  }, [user]);

  useEffect(() => {
    fetchEmailConfig();
    fetchPreferences();
  }, [fetchEmailConfig, fetchPreferences]);

  // Save email config
  const handleSaveEmail = async () => {
    if (!emailConfig) return;
    setSavingEmail(true);

    const { error } = await supabase
      .from("email_config")
      .update({
        notify_threats: emailConfig.notify_threats,
        notify_vulns: emailConfig.notify_vulns,
        notify_reports: emailConfig.notify_reports,
        recipient_email: emailConfig.recipient_email,
      })
      .eq("id", emailConfig.id);

    if (error) {
      toast({
        title: "Error al guardar configuracion",
        variant: "destructive",
      });
    } else {
      toast({ title: "Configuracion de notificaciones guardada" });
    }

    setSavingEmail(false);
  };

  // Test email
  const handleTestEmail = async () => {
    setTestingEmail(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sin sesion activa");

      const res = await fetch(`${AGENT_URL}/api/notifications/test-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          recipient: emailConfig?.recipient_email ?? user?.email,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { error?: string }).error ?? `Error: ${res.status}`,
        );
      }

      toast({ title: "Email de prueba enviado" });
    } catch (err) {
      toast({
        title: "Error al enviar email de prueba",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setTestingEmail(false);
    }
  };

  // Save preferences
  const handleSavePrefs = async () => {
    if (!prefs) return;
    setSavingPrefs(true);

    const { error } = await supabase
      .from("user_preferences")
      .update({
        compact_mode: prefs.compact_mode,
      })
      .eq("id", prefs.id);

    if (error) {
      toast({
        title: "Error al guardar preferencias",
        variant: "destructive",
      });
    } else {
      toast({ title: "Preferencias guardadas" });
    }

    setSavingPrefs(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Configuracion
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Administra tus notificaciones y preferencias de la plataforma.
        </p>
      </div>

      <Tabs defaultValue="notificaciones" className="w-full">
        <TabsList>
          <TabsTrigger value="notificaciones" className="gap-2">
            <Bell className="h-4 w-4" />
            Notificaciones
          </TabsTrigger>
          <TabsTrigger value="preferencias" className="gap-2">
            <Palette className="h-4 w-4" />
            Preferencias
          </TabsTrigger>
        </TabsList>

        {/* Notifications Tab */}
        <TabsContent value="notificaciones">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4" />
                Configuracion de Email
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingEmail ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : emailConfig ? (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">
                          Notificar amenazas
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Recibe alertas cuando se detecten nuevas amenazas.
                        </p>
                      </div>
                      <Switch
                        checked={emailConfig.notify_threats}
                        onCheckedChange={(v) =>
                          setEmailConfig((c) =>
                            c ? { ...c, notify_threats: v } : c,
                          )
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">
                          Notificar vulnerabilidades
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Recibe alertas sobre nuevas vulnerabilidades
                          encontradas.
                        </p>
                      </div>
                      <Switch
                        checked={emailConfig.notify_vulns}
                        onCheckedChange={(v) =>
                          setEmailConfig((c) =>
                            c ? { ...c, notify_vulns: v } : c,
                          )
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">
                          Notificar reportes
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Recibe un email cuando se genere un nuevo reporte.
                        </p>
                      </div>
                      <Switch
                        checked={emailConfig.notify_reports}
                        onCheckedChange={(v) =>
                          setEmailConfig((c) =>
                            c ? { ...c, notify_reports: v } : c,
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="recipientEmail">
                      Email del destinatario
                    </Label>
                    <Input
                      id="recipientEmail"
                      type="email"
                      placeholder="correo@ejemplo.com"
                      value={emailConfig.recipient_email ?? ""}
                      onChange={(e) =>
                        setEmailConfig((c) =>
                          c
                            ? { ...c, recipient_email: e.target.value || null }
                            : c,
                        )
                      }
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button onClick={handleSaveEmail} disabled={savingEmail}>
                      {savingEmail && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Guardar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleTestEmail}
                      disabled={testingEmail}
                    >
                      {testingEmail && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Enviar email de prueba
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No se pudo cargar la configuracion de email.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferencias">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Palette className="h-4 w-4" />
                Preferencias de interfaz
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingPrefs ? (
                <div className="space-y-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-10 w-32" />
                </div>
              ) : prefs ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">
                        Modo compacto
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Reduce el espaciado y tamanio de los elementos de la
                        interfaz.
                      </p>
                    </div>
                    <Switch
                      checked={prefs.compact_mode}
                      onCheckedChange={(v) =>
                        setPrefs((p) => (p ? { ...p, compact_mode: v } : p))
                      }
                    />
                  </div>

                  <Button onClick={handleSavePrefs} disabled={savingPrefs}>
                    {savingPrefs && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Guardar
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No se pudieron cargar las preferencias.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
