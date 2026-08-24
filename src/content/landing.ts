/**
 * Copy de la landing.
 *
 * Se extrajo del JSX por la misma razon que faq.ts y plans.ts: el prerender
 * necesita emitir exactamente este texto en el HTML estatico. Si el copy viviera
 * suelto dentro del componente, el HTML que ve un buscador y el que ve una
 * persona se irian separando en cuanto alguien editara uno de los dos.
 */

export const HERO = {
  eyebrow: "Plataforma de auditoría de seguridad de red",
  h1: "Auditoría de seguridad para tu red.",
  lead: "S.S.S detecta los dispositivos conectados a tu red, identifica los puertos y servicios expuestos y te notifica ante cambios o amenazas. Todo el análisis se ejecuta mediante un agente local, sin exponer tu red a internet.",
  note: "Sin registro: chequeo rápido de tu conexión actual. Con cuenta: escaneo completo de tu Wi-Fi, historial y reportes.",
};

export interface TextItem {
  title: string;
  desc: string;
}

export const FEATURES: TextItem[] = [
  {
    title: "Inventario de dispositivos",
    desc: "Identifica cada equipo conectado a tu red (teléfono, televisor, cámara, consola o dispositivo desconocido) junto con su IP, fabricante y sistema operativo.",
  },
  {
    title: "Puertos y servicios expuestos",
    desc: "Detecta servicios accesibles desde tu red, como Telnet, RDP, SMB o bases de datos, antes de que se conviertan en un vector de riesgo.",
  },
  {
    title: "Asistente de análisis (ACi)",
    desc: "Interpreta los resultados de cada análisis, explica el significado de los puertos detectados y sugiere los pasos a seguir.",
  },
];

export const STEPS: TextItem[] = [
  {
    title: "Instala el agente",
    desc: "Se instala una sola vez y ejecuta los análisis dentro de tu red. Sin él, ni la plataforma ni terceros pueden acceder a tu red local.",
  },
  {
    title: "Ejecuta un análisis",
    desc: "Desde cualquier navegador. El agente descubre los dispositivos y servicios activos en cuestión de segundos.",
  },
  {
    title: "Recibe notificaciones",
    desc: "La plataforma te avisa por correo cuando aparece un dispositivo nuevo o un puerto expuesto en tu red.",
  },
];

export const SECURITY: TextItem[] = [
  {
    title: "Aislamiento de datos por cuenta",
    desc: "Cada cuenta dispone de su propio espacio con políticas RLS estrictas en Supabase. Ningún otro usuario, ni el equipo de S.S.S, puede acceder a tus resultados. El agente se ejecuta en tu equipo y el tráfico real nunca abandona tu red.",
  },
  {
    title: "Alcance limitado a redes privadas",
    desc: "Por diseño, solo se permite el análisis de rangos privados (192.168/16, 10/8, 172.16-31/12). Analizar redes públicas sin autorización es ilegal en numerosos países e infringe los términos de servicio de tu proveedor; la plataforma no lo permite.",
  },
];
