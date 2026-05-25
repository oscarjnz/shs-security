import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { listKev } from "@/lib/cveApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Flame, Loader2, Search, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { es as esLocale } from "date-fns/locale";

const PAGE_SIZE = 50;

export function KevCatalogPage() {
  const [search, setSearch] = useState("");
  const [pendingSearch, setPendingSearch] = useState("");
  const [vendor, setVendor] = useState("");
  const [ransomwareOnly, setRansomwareOnly] = useState(false);
  const [page, setPage] = useState(0);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["kev", search, vendor, ransomwareOnly, page],
    queryFn: () =>
      listKev({
        search: search || undefined,
        vendor: vendor || undefined,
        ransomware: ransomwareOnly || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const applySearch = () => {
    setSearch(pendingSearch.trim());
    setPage(0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Flame className="h-8 w-8 shrink-0 text-red-500" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">
            CISA KEV — Explotados activamente
          </h1>
          <p className="text-sm text-muted-foreground">
            Catálogo oficial de vulnerabilidades que se sabe están siendo explotadas por
            atacantes. Sincronizado diariamente desde cisa.gov.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              applySearch();
            }}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={pendingSearch}
                onChange={(e) => setPendingSearch(e.target.value)}
                placeholder="Buscar CVE, nombre, vendor o producto…"
                className="pl-9"
              />
            </div>
            <Input
              value={vendor}
              onChange={(e) => {
                setVendor(e.target.value);
                setPage(0);
              }}
              placeholder="Filtrar por vendor (ej. Microsoft)"
              className="sm:max-w-[200px]"
            />
            <div className="flex items-center gap-2">
              <Switch
                id="ransomware-only"
                checked={ransomwareOnly}
                onCheckedChange={(v) => {
                  setRansomwareOnly(v);
                  setPage(0);
                }}
              />
              <Label htmlFor="ransomware-only" className="text-sm">
                Solo ransomware
              </Label>
            </div>
            <Button type="submit">Buscar</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isFetching ? "Cargando…" : `${total} vulnerabilidad${total === 1 ? "" : "es"} en el catálogo`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (data?.data ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No se encontraron resultados
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CVE</TableHead>
                    <TableHead>Vendor / Producto</TableHead>
                    <TableHead>Vulnerabilidad</TableHead>
                    <TableHead>Añadida</TableHead>
                    <TableHead>Ransomware</TableHead>
                    <TableHead className="text-right">Detalles</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.data ?? []).map((kev) => {
                    const isRansomware = (kev.known_ransomware_use ?? "")
                      .toLowerCase()
                      .includes("known");
                    return (
                      <TableRow key={kev.cve_id}>
                        <TableCell className="font-mono text-xs">
                          <Link
                            to={`/vulnerability/${kev.cve_id}`}
                            className="text-primary hover:underline"
                          >
                            {kev.cve_id}
                          </Link>
                        </TableCell>
                        <TableCell className="capitalize">
                          <div className="text-sm font-medium">{kev.vendor ?? "-"}</div>
                          <div className="text-xs text-muted-foreground">{kev.product ?? ""}</div>
                        </TableCell>
                        <TableCell className="max-w-[300px]">
                          <div className="truncate text-sm" title={kev.vulnerability_name ?? ""}>
                            {kev.vulnerability_name ?? "-"}
                          </div>
                          <div
                            className="truncate text-xs text-muted-foreground"
                            title={kev.short_description ?? ""}
                          >
                            {kev.short_description ?? ""}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {kev.date_added
                            ? format(new Date(kev.date_added), "dd MMM yyyy", { locale: esLocale })
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {isRansomware ? (
                            <Badge className="bg-purple-700 text-white">Sí</Badge>
                          ) : (
                            <Badge variant="outline">No conocido</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/vulnerability/${kev.cve_id}`}>
                              Ver
                              <ExternalLink className="ml-1 h-3 w-3" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Página {page + 1} de {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0 || isFetching}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1 || isFetching}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
