import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { SectionKey, PermLevel, Permissions } from "@/lib/database.types";

interface PermissionsGridProps {
  permissions: Permissions;
  onChange: (perms: Permissions) => void;
  sections: readonly SectionKey[];
}

const LABELS: Record<SectionKey, string> = {
  dashboard: "Dashboard",
  network: "Red",
  devices: "Dispositivos",
  threats: "Amenazas",
  vulnerabilities: "Vulnerabilidades",
  logs: "Logs",
  ai_analysis: "AI Analysis",
  reports: "Reportes",
  settings: "Configuración",
};

export function PermissionsGrid({ permissions, onChange, sections }: PermissionsGridProps) {
  const handleChange = (section: SectionKey, level: PermLevel) => {
    onChange({ ...permissions, [section]: level });
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Permisos por sección</Label>
      <div className="grid gap-2">
        {sections.map((section) => (
          <div key={section} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <span className="text-sm text-foreground">{LABELS[section]}</span>
            <Select
              value={permissions[section]}
              onValueChange={(v) => handleChange(section, v as PermLevel)}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ninguno</SelectItem>
                <SelectItem value="view">Ver</SelectItem>
                <SelectItem value="full">Completo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  );
}
