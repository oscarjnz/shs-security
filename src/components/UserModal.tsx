import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionsGrid } from "@/components/PermissionsGrid";
import { SECTION_KEYS, defaultPermissionsForRole } from "@/lib/auth";
import type { Permissions, UserRole, ProfileRow } from "@/lib/database.types";
import { AGENT_URL } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface UserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  editingUser?: { id: string; email: string; profile: ProfileRow; permissions: Permissions } | null;
  onSuccess: () => void;
}

export function UserModal({ open, onOpenChange, token, editingUser, onSuccess }: UserModalProps) {
  const isEditing = !!editingUser;
  const [email, setEmail] = useState(editingUser?.email ?? "");
  const [fullName, setFullName] = useState(editingUser?.profile.full_name ?? "");
  const [role, setRole] = useState<UserRole>(editingUser?.profile.role ?? "normal");
  const [password, setPassword] = useState("");
  const [permissions, setPermissions] = useState<Permissions>(
    editingUser?.permissions ?? defaultPermissionsForRole("normal"),
  );
  const [saving, setSaving] = useState(false);

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    setPermissions(defaultPermissionsForRole(newRole));
  };

  const handleSubmit = async () => {
    if (!fullName.trim()) {
      toast({ title: "Nombre requerido", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const url = isEditing
        ? `${AGENT_URL}/api/admin/users/update`
        : `${AGENT_URL}/api/admin/users/create`;

      const body = isEditing
        ? { user_id: editingUser.id, full_name: fullName, role, permissions }
        : { email, full_name: fullName, role, password: password || undefined, permissions };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al guardar");

      toast({ title: isEditing ? "Usuario actualizado" : "Usuario creado" });
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar usuario" : "Crear usuario"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!isEditing && (
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="fullName">Nombre completo</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>

          {!isEditing && (
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña (opcional: se genera automáticamente)</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          )}

          <div className="space-y-2">
            <Label>Rol</Label>
            <Select value={role} onValueChange={(v) => handleRoleChange(v as UserRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="guest">Guest</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <PermissionsGrid
            permissions={permissions}
            onChange={setPermissions}
            sections={SECTION_KEYS}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Guardar" : "Crear"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
