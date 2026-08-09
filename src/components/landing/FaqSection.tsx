import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Reveal } from "@/components/ui/Reveal";

const FAQS: { q: string; a: string }[] = [
  {
    q: "¿Qué es S.S.S?",
    a: "Una plataforma de auditoría de seguridad para redes domésticas y de pequeñas empresas. Un agente que instalas en tu red revisa los dispositivos conectados, los puertos y servicios expuestos, y las vulnerabilidades conocidas asociadas; los resultados se consultan desde cualquier navegador.",
  },
  {
    q: "¿Cómo analiza mi red sin tener acceso directo a ella desde la nube?",
    a: "El agente corre dentro de tu red y abre únicamente conexiones salientes hacia la nube. No se abre ningún puerto de entrada ni se necesita tocar la configuración del router. Sin el agente instalado, nadie, ni la plataforma, puede llegar a tu red privada.",
  },
  {
    q: "¿Qué necesito instalar y en qué sistemas operativos funciona?",
    a: "El agente local (scanner-agent), disponible para Windows, macOS y Linux. Se instala una sola vez y usa nmap por debajo para ejecutar los análisis.",
  },
  {
    q: "¿Qué información puedo ver de mi red?",
    a: "Los dispositivos conectados con su IP, MAC, fabricante y sistema operativo; los puertos y servicios expuestos; las vulnerabilidades conocidas (CVE) asociadas a lo que encuentra; y las amenazas que la plataforma detecta con su severidad.",
  },
  {
    q: "¿Es legal escanear cualquier red con esta herramienta?",
    a: "No, y la plataforma no lo permite. Por diseño, solo se pueden analizar rangos de IP privados (tu propia red: 192.168.x.x, 10.x.x.x, 172.16-31.x.x). Escanear una red pública o de un tercero sin autorización es ilegal en la mayoría de países.",
  },
  {
    q: "¿Quién más puede ver mis datos?",
    a: "Nadie más. Cada cuenta tiene su propio espacio protegido con políticas de seguridad a nivel de fila en la base de datos, así que ni otros usuarios ni el equipo de S.S.S acceden a tus resultados.",
  },
  {
    q: "¿Puedo compartir el acceso con otras personas?",
    a: "Sí, según el plan. Cada persona que agregues tiene un rol (administrador, normal o invitado) con permisos independientes por sección: alguien puede ver amenazas sin poder cambiar la configuración, por ejemplo.",
  },
  {
    q: "¿Qué pasa si apago el equipo donde está instalado el agente?",
    a: "El agente aparece como desconectado y no se pueden lanzar escaneos nuevos hasta que vuelva a encenderse. El historial y los datos que ya se guardaron siguen disponibles porque viven en la nube, no en tu equipo.",
  },
  {
    q: "¿Todas las funciones que se muestran en el panel ya funcionan de verdad?",
    a: "La mayoría sí. La sección de tráfico y estado de red (velocidad de subida y bajada) todavía está en desarrollo y lo indicamos claramente donde aparece, en vez de mostrar una pantalla vacía sin explicación.",
  },
  {
    q: "¿Cuánto cuesta y en qué se diferencian los planes?",
    a: "Hay tres planes ($10, $20 y $50 al mes). La diferencia principal es cuántas redes puedes cubrir y cuánta gente puede entrar con su propio rol; la detección de amenazas y el escáner de vulnerabilidades están disponibles desde el plan más económico.",
  },
];

export function FaqSection() {
  return (
    <section id="preguntas-frecuentes" className="border-t border-border/60 py-16 scroll-mt-14">
      <div className="mx-auto max-w-3xl px-4">
        <Reveal>
          <h2 className="text-center text-2xl font-bold text-foreground">
            Preguntas frecuentes
          </h2>
        </Reveal>

        <Reveal delay={80} className="mt-8">
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((item, i) => (
              <AccordionItem key={item.q} value={`item-${i}`} className="border-border/60">
                <AccordionTrigger className="text-left text-sm font-semibold text-foreground">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
