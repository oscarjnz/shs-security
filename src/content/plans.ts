/**
 * Planes publicados en la landing.
 *
 * Se comparten entre la seccion de precios, el esquema SoftwareApplication de
 * schema.org y el prerender. El precio que declara el esquema tiene que ser el
 * mismo que ve el visitante: un esquema que no coincide con la pagina es motivo
 * de penalizacion en Google.
 *
 * OJO: todavia no hay cobro integrado (ver la nota bajo las tarjetas en la
 * landing). Si algun dia se conecta Clerk Billing o Stripe, este modulo es el
 * lugar donde deben quedar los precios definitivos.
 */
export interface Plan {
  name: string;
  tag: string;
  price: number;
  desc: string;
  features: string[];
  inherited?: string;
  highlighted?: boolean;
}

export const PLANS: Plan[] = [
  {
    name: "Hogar",
    tag: "Una red, un usuario",
    price: 10,
    desc: "Cubre una red doméstica administrada por una sola persona.",
    features: [
      "1 agente de escaneo",
      "Panel en tiempo real y registro de actividad",
      "Detección de amenazas y escáner de vulnerabilidades (CVE, CVSS)",
      "Inventario de dispositivos conectados",
      "Notificaciones por correo",
      "Historial de 30 días",
    ],
  },
  {
    name: "Hogar plus",
    tag: "Varias redes o personas",
    price: 20,
    desc: "Para quien administra más de una red o comparte el acceso con su equipo o familia.",
    inherited: "Todo lo del plan Hogar",
    features: [
      "Hasta 3 agentes de escaneo",
      "Hasta 5 usuarios, cada uno con su rol (administrador, normal, invitado)",
      "Análisis con IA sobre los resultados de escaneo",
      "Geolocalización de IP pública",
      "Reportes en PDF sin límite (generar, enviar, descargar)",
      "Historial de 90 días",
    ],
    highlighted: true,
  },
  {
    name: "Negocio",
    tag: "Sin límite de alcance",
    price: 50,
    desc: "Para un equipo que necesita administrar acceso granular y conservar el historial completo.",
    inherited: "Todo lo del plan Hogar plus",
    features: [
      "Agentes de escaneo sin límite",
      "Usuarios sin límite, con permisos granulares por sección",
      "Alertas prioritarias del catálogo KEV y OWASP",
      "Historial de 12 meses",
      "Soporte por correo con respuesta prioritaria",
    ],
  },
];
