import {
  Bell,
  CheckCheck,
  Trash2,
  ExternalLink,
  AlertTriangle,
  Info,
  ShieldAlert,
  FileText,
  Wifi,
} from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const CATEGORY_ICONS: Record<string, typeof Info> = {
  threat: ShieldAlert,
  vulnerability: AlertTriangle,
  report: FileText,
  network: Wifi,
  system: Info,
};

const CATEGORY_LABELS: Record<string, string> = {
  threat: "Amenaza",
  vulnerability: "Vulnerabilidad",
  report: "Reporte",
  network: "Red",
  system: "Sistema",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `hace ${days}d`;
  if (hours > 0) return `hace ${hours}h`;
  if (minutes > 0) return `hace ${minutes}m`;
  return "ahora";
}

export function NotificationsPage() {
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    dismiss,
    dismissAll,
  } = useNotifications();

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Notificaciones
            </h1>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-1">
                {unreadCount}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Centro de alertas y notificaciones del sistema.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
          >
            <CheckCheck className="mr-2 h-4 w-4" />
            Marcar todo leido
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={dismissAll}
            disabled={notifications.filter((n) => n.read).length === 0}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Descartar leidos
          </Button>
        </div>
      </div>

      {/* Notifications list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Bell className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">
              No hay notificaciones
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Las alertas y eventos del sistema apareceran aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const CategoryIcon = CATEGORY_ICONS[n.category] ?? Info;

            return (
              <Card
                key={n.id}
                className={`transition-colors ${!n.read ? "border-primary/30 bg-primary/5" : ""}`}
              >
                <CardContent className="flex items-start gap-4 py-4">
                  {/* Icon */}
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      n.type === "error" || n.type === "critical"
                        ? "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300"
                        : n.type === "warning"
                          ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-300"
                          : "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300"
                    }`}
                  >
                    <CategoryIcon className="h-5 w-5" />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3
                        className={`text-sm ${!n.read ? "font-semibold" : "font-medium"}`}
                      >
                        {n.title}
                      </h3>
                      <Badge variant="secondary" className="text-[10px]">
                        {CATEGORY_LABELS[n.category] ?? n.category}
                      </Badge>
                      {!n.read && (
                        <span className="h-2 w-2 rounded-full bg-primary" />
                      )}
                    </div>

                    {n.description && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {n.description}
                      </p>
                    )}

                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-[10px] text-muted-foreground">
                        {timeAgo(n.created_at)}
                      </span>

                      {n.link && (
                        <a
                          href={n.link}
                          className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                        >
                          Ver detalle
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 gap-1">
                    {!n.read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Marcar como leido"
                        onClick={() => markAsRead(n.id)}
                      >
                        <CheckCheck className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Descartar"
                      onClick={() => dismiss(n.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
