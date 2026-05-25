/*
 * Local OWASP Top 10 (2021) knowledge base used as Groq system context.
 * Hand-written in Spanish, didactic tone aimed at non-technical users.
 */

export interface OwaspItem {
  id: string;
  rank: number;
  name: string;
  shortName: string;
  description: string;
  example: string;
  mitigation: string;
}

export const OWASP_TOP_10: OwaspItem[] = [
  {
    id: "A01",
    rank: 1,
    name: "A01:2021 — Pérdida de control de acceso",
    shortName: "Control de acceso roto",
    description:
      "Pasa cuando una aplicación deja entrar a alguien a un sitio donde no debería: ver datos de otra persona, cambiar configuración que no le pertenece, o saltarse pantallas de permisos. Suele ser un descuido del programador al revisar quién es quién antes de enseñar información.",
    example:
      "Cambias el número de tu factura en la URL (.../factura/123 a .../factura/124) y la web te muestra la factura de otra persona.",
    mitigation:
      "Que la app valide en el servidor (no en el navegador) quién eres antes de cada acción. Roles claros y nunca confiar en lo que dice el cliente.",
  },
  {
    id: "A02",
    rank: 2,
    name: "A02:2021 — Fallas criptográficas",
    shortName: "Datos sin cifrar correctamente",
    description:
      "Cuando información sensible (contraseñas, tarjetas, identificaciones) se guarda o viaja sin protección adecuada, o con métodos de cifrado anticuados que ya no sirven.",
    example:
      "Una web guarda las contraseñas tal cual, sin cifrarlas. Si la roban, las tienen todas en bandeja.",
    mitigation:
      "Cifrar todo en tránsito (HTTPS) y en reposo. Usar algoritmos modernos (AES-256, bcrypt/argon2 para contraseñas). Nunca inventar tu propio cifrado.",
  },
  {
    id: "A03",
    rank: 3,
    name: "A03:2021 — Inyección",
    shortName: "Inyección (SQLi, XSS, etc.)",
    description:
      "Cuando lo que el usuario escribe se mete directo en una consulta a la base de datos o en una página web sin limpiarlo, permitiendo que un atacante inserte instrucciones maliciosas.",
    example:
      "En un formulario de login, escribes algo como ' OR 1=1 -- y entras sin saber la contraseña porque la web no filtró ese texto.",
    mitigation:
      "Usar consultas parametrizadas, validar y escapar todo lo que viene del usuario, librerías que separen datos de código.",
  },
  {
    id: "A04",
    rank: 4,
    name: "A04:2021 — Diseño inseguro",
    shortName: "Diseño inseguro",
    description:
      "Errores que vienen desde el plano: la aplicación nunca tuvo en cuenta amenazas básicas al diseñarla. No es un bug, es una omisión de seguridad de raíz.",
    example:
      "Una tienda online permite hacer infinitos intentos de cupones de descuento sin límite, y alguien encuentra uno válido por fuerza bruta.",
    mitigation:
      "Modelado de amenazas desde el inicio del proyecto, límites de uso, principios de mínimo privilegio en cada flujo.",
  },
  {
    id: "A05",
    rank: 5,
    name: "A05:2021 — Configuración de seguridad incorrecta",
    shortName: "Mala configuración",
    description:
      "La app está bien hecha, pero quedó mal instalada: usuarios por defecto, paneles de admin expuestos, mensajes de error que revelan información, servicios innecesarios encendidos.",
    example:
      "Un servidor con phpMyAdmin accesible desde internet con usuario admin/admin.",
    mitigation:
      "Plantilla de despliegue endurecida, cambiar credenciales por defecto, cerrar puertos innecesarios, mensajes de error genéricos.",
  },
  {
    id: "A06",
    rank: 6,
    name: "A06:2021 — Componentes vulnerables y desactualizados",
    shortName: "Librerías desactualizadas",
    description:
      "Casi toda app moderna usa librerías y plugins de terceros. Si están desactualizados, las vulnerabilidades conocidas de esas piezas pasan automáticamente a tu aplicación.",
    example:
      "Una web con WordPress de hace 3 años, con plugins viejos: cualquier vulnerabilidad pública de esa versión la pueden explotar.",
    mitigation:
      "Inventariar dependencias, actualizar regularmente, suscribirse a alertas (Dependabot, Snyk), eliminar lo que no se usa.",
  },
  {
    id: "A07",
    rank: 7,
    name: "A07:2021 — Fallas de identificación y autenticación",
    shortName: "Autenticación débil",
    description:
      "Sistemas de login que aceptan contraseñas débiles, no bloquean tras intentos fallidos, no exigen segundo factor o exponen tokens de sesión.",
    example:
      "Una app deja probar 100.000 contraseñas por minuto sin bloquear ni avisar.",
    mitigation:
      "Contraseñas largas, MFA obligatorio para cuentas sensibles, rate limiting, no exponer si el usuario existe o no en el error.",
  },
  {
    id: "A08",
    rank: 8,
    name: "A08:2021 — Fallas en integridad de software y datos",
    shortName: "Cadena de suministro",
    description:
      "Cuando se confía ciegamente en código, librerías o actualizaciones que vienen de fuera, sin verificar que no las hayan alterado.",
    example:
      "El ataque a SolarWinds: una actualización legítima de software fue alterada por atacantes y se distribuyó a miles de empresas.",
    mitigation:
      "Firmas digitales en updates, mirrors de confianza, SBOM (lista de componentes), pinning de versiones.",
  },
  {
    id: "A09",
    rank: 9,
    name: "A09:2021 — Fallas de registro y monitoreo",
    shortName: "Sin logs ni monitoreo",
    description:
      "Cuando un sistema no registra eventos importantes (logins fallidos, cambios de permisos, errores), un ataque puede pasar inadvertido durante meses.",
    example:
      "Un atacante prueba contraseñas durante semanas y nadie se entera porque no hay alertas.",
    mitigation:
      "Logs centralizados de eventos críticos, alertas automáticas en patrones sospechosos, retención mínima de 90 días.",
  },
  {
    id: "A10",
    rank: 10,
    name: "A10:2021 — Server-Side Request Forgery (SSRF)",
    shortName: "SSRF",
    description:
      "Cuando una aplicación hace peticiones a URLs que el usuario indica, sin validar. Un atacante puede hacer que el servidor pida cosas internas que no debería.",
    example:
      "Una web te deja poner una URL para descargar una imagen de perfil. Pones http://localhost:6379 y accede a tu Redis interno.",
    mitigation:
      "Allowlist de hosts permitidos, bloquear rangos privados (RFC1918, localhost), validar respuestas antes de procesarlas.",
  },
];

export function owaspSystemPrompt(): string {
  const summary = OWASP_TOP_10.map(
    (o) => `${o.id} ${o.shortName}: ${o.description}`,
  ).join("\n\n");
  return (
    "Eres ACi, asistente educativo de S.S.S (Security Smart Services). Tu rol es " +
    "enseñar a usuarios NO informáticos (familias, hogares) sobre seguridad web y " +
    "el OWASP Top 10, en español, de forma magistral, cercana y muy clara. Usa " +
    "analogías cotidianas (la casa, la oficina del banco, las cerraduras). NUNCA " +
    "uses jerga técnica sin explicarla. Varía vocabulario y estructura cada vez que " +
    "respondas: no repitas la misma frase dos veces seguidas. Cierra recordando " +
    "que la información oficial original está en inglés en owasp.org y que tú la " +
    "estás explicando y adaptando al español. Si la pregunta no tiene que ver con " +
    "seguridad, redirige amablemente al tema.\n\n" +
    "CONOCIMIENTO BASE (OWASP Top 10 2021):\n\n" +
    summary
  );
}
