import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "@/components/ui/Reveal";
import { cn } from "@/lib/utils";
import { PLANS } from "@/content/plans";


export function PricingSection() {
  return (
    <section id="precios" className="border-t border-border/60 py-16 scroll-mt-14">
      <div className="mx-auto max-w-5xl px-4">
        <Reveal>
          <h2 className="text-center text-2xl font-bold text-foreground">Planes</h2>
          <p className="mx-auto mt-2 max-w-md text-center text-sm text-muted-foreground">
            El precio sube con cuántas redes cubres y cuánta gente accede con su propio rol.
            La detección de amenazas y vulnerabilidades está disponible en todos los planes.
          </p>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {PLANS.map((plan, i) => (
            <Reveal key={plan.name} delay={i * 80} className="flex">
              <Card
                className={cn(
                  "surface-glass hoverable-card flex w-full flex-col",
                  plan.highlighted && "border-cyber-green/40",
                )}
              >
                <CardContent className="flex flex-1 flex-col p-6">
                  <p className="text-sm font-bold text-foreground">{plan.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{plan.tag}</p>

                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-sm text-muted-foreground">$</span>
                    <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-xs text-muted-foreground">/mes</span>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    {plan.desc}
                  </p>

                  <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                    {plan.inherited && (
                      <li className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                        {plan.inherited}
                      </li>
                    )}
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-foreground">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyber-green" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Button
                    asChild
                    variant={plan.highlighted ? "default" : "outline"}
                    className={cn(
                      "pressable mt-6 rounded-full",
                      plan.highlighted &&
                        "bg-cyber-green font-semibold text-cyber-dark hover:bg-cyber-green/90",
                    )}
                  >
                    <Link to="/signup">Seleccionar plan</Link>
                  </Button>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>

        <Reveal delay={240}>
          <p className="mx-auto mt-6 max-w-xl text-center text-xs text-muted-foreground">
            El producto está en etapa beta: el registro es gratuito por ahora y la facturación por
            plan todavía no está activa. Estos precios reflejan la estructura que usaremos cuando
            se habilite el cobro.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
