import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
} from "lucide-react";
import { supabase, AGENT_URL } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { permissionRowsToMap, defaultPermissionsForRole } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { UserModal } from "@/components/UserModal";
import type {
  ProfileRow,
  Permissions,
  PermissionRow,
} from "@/lib/database.types";

interface UserEntry {
  id: string;
  email: string;
  profile: ProfileRow;
  permissions: Permissions;
}

export function UsersPage() {
  const { isAdmin, user } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserEntry | null>(null);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toggle state
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Redirect non-admin users
  useEffect(() => {
    if (!isAdmin) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAdmin, navigate]);

  // Get auth token
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) {
        setToken(session.access_token);
      }
    });
  }, []);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);

    try {
      const res = await fetch(`${AGENT_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { error?: string }).error ?? `Error: ${res.status}`,
        );
      }

      const json = (await res.json()) as {
        users: Array<{ id: string; email: string }>;
      };
      const adminUsers = json.users ?? [];

      // Fetch profiles and permissions in parallel
      const entries = await Promise.all(
        adminUsers.map(async (u) => {
          const [profileRes, permRes] = await Promise.all([
            supabase.from("profiles").select("*").eq("id", u.id).single(),
            supabase
              .from("permissions")
              .select("*")
              .eq("user_id", u.id),
          ]);

          const profile = (profileRes.data as ProfileRow | null) ?? {
            id: u.id,
            full_name: u.email.split("@")[0],
            avatar_url: null,
            role: "normal" as const,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          const permRows = (permRes.data ?? []) as PermissionRow[];
          const permissions =
            permRows.length > 0
              ? permissionRowsToMap(permRows)
              : defaultPermissionsForRole(profile.role);

          return {
            id: u.id,
            email: u.email,
            profile,
            permissions,
          } as UserEntry;
        }),
      );

      setUsers(entries);
    } catch (err) {
      toast({
        title: "Error al cargar usuarios",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchUsers();
  }, [token, fetchUsers]);

  // Open modal for create
  const handleCreate = () => {
    setEditingUser(null);
    setModalOpen(true);
  };

  // Open modal for edit
  const handleEdit = (u: UserEntry) => {
    setEditingUser(u);
    setModalOpen(true);
  };

  // Toggle active status
  const handleToggleActive = async (u: UserEntry) => {
    setTogglingId(u.id);

    try {
      const res = await fetch(`${AGENT_URL}/api/admin/user-status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: u.id,
          is_active: !u.profile.is_active,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { error?: string }).error ?? `Error: ${res.status}`,
        );
      }

      toast({
        title: u.profile.is_active
          ? "Usuario desactivado"
          : "Usuario activado",
      });
      await fetchUsers();
    } catch (err) {
      toast({
        title: "Error al cambiar estado",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setTogglingId(null);
    }
  };

  // Open delete confirmation
  const handleDeleteClick = (u: UserEntry) => {
    setDeletingUser(u);
    setDeleteDialogOpen(true);
  };

  // Confirm delete
  const handleDeleteConfirm = async () => {
    if (!deletingUser) return;
    setDeleting(true);

    try {
      const res = await fetch(`${AGENT_URL}/api/admin/user`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: deletingUser.id }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { error?: string }).error ?? `Error: ${res.status}`,
        );
      }

      toast({ title: "Usuario eliminado" });
      setDeleteDialogOpen(false);
      setDeletingUser(null);
      await fetchUsers();
    } catch (err) {
      toast({
        title: "Error al eliminar usuario",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Gestion de Usuarios
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Administra los usuarios, roles y permisos de la plataforma.
          </p>
        </div>

        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Crear Usuario
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Usuarios registrados
            {!loading && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({users.length})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No se encontraron usuarios.
            </p>
          ) : (
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono text-sm">
                        {u.email}
                      </TableCell>
                      <TableCell>{u.profile.full_name}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            u.profile.role === "admin"
                              ? "default"
                              : u.profile.role === "normal"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {u.profile.role === "admin"
                            ? "Admin"
                            : u.profile.role === "normal"
                              ? "Normal"
                              : "Invitado"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            u.profile.is_active ? "default" : "destructive"
                          }
                          className={
                            u.profile.is_active
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                              : ""
                          }
                        >
                          {u.profile.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Editar"
                            onClick={() => handleEdit(u)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title={
                              u.profile.is_active ? "Desactivar" : "Activar"
                            }
                            onClick={() => handleToggleActive(u)}
                            disabled={togglingId === u.id || u.id === user?.id}
                          >
                            {togglingId === u.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : u.profile.is_active ? (
                              <ToggleRight className="h-4 w-4 text-green-600" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            title="Eliminar"
                            onClick={() => handleDeleteClick(u)}
                            disabled={u.id === user?.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User modal */}
      <UserModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        token={token}
        editingUser={editingUser}
        onSuccess={fetchUsers}
      />

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar usuario</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion no se puede deshacer. Se eliminara permanentemente la
              cuenta de <strong>{deletingUser?.email}</strong> y todos sus datos
              asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
