import { Link, useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useUser } from "@clerk/react";

export function PublicHeader() {
  const { isSignedIn } = useUser();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border bg-cyber-dark/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <Logo className="h-7 w-7" />
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight text-foreground">S.S.S</p>
            <p className="text-[10px] text-muted-foreground">Security Smart Services</p>
          </div>
        </Link>

        <nav className="flex items-center gap-2">
          <Link
            to="/demo"
            className="hidden text-xs font-medium text-muted-foreground hover:text-foreground sm:inline"
          >
            Probar demo
          </Link>

          {isSignedIn ? (
            <Button size="sm" onClick={() => navigate("/dashboard")} className="gap-2">
              Ir al dashboard
            </Button>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={() => navigate("/login")}>
                Iniciar sesión
              </Button>
              <Button size="sm" onClick={() => navigate("/signup")} className="gap-2">
                Crear cuenta
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
