/**
 * Guias publicas de la seccion /guias.
 *
 * Existen por una razon concreta de posicionamiento: la landing solo puede
 * competir por el nombre de la marca. Quien busca "como saber quien esta
 * conectado a mi wifi" nunca va a escribir "Security Smart Services", asi que
 * hace falta contenido que responda esa pregunta de verdad. Cada guia se
 * sostiene sola como articulo util y solo al final conecta con el producto.
 *
 * El texto sale de aqui para el componente React, para el esquema Article de
 * schema.org y para el prerender de HTML estatico, de modo que lo que lee un
 * buscador y lo que lee una persona sean exactamente lo mismo.
 */

export type Block =
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "note"; text: string };

export interface GuideSection {
  heading: string;
  body: Block[];
}

export interface Guide {
  /** Ultimo segmento de la URL: /guias/<slug> */
  slug: string;
  /** <title> del documento. Apuntar a 50-60 caracteres. */
  title: string;
  /** <h1> visible. Puede ser mas largo y natural que el title. */
  h1: string;
  /** Meta description. Apuntar a 120-160 caracteres. */
  description: string;
  /** Frase que resume la guia en la tarjeta del indice. */
  summary: string;
  /** Consulta principal que la guia intenta responder. */
  primaryQuery: string;
  datePublished: string;
  dateModified: string;
  readingMinutes: number;
  sections: GuideSection[];
}

export const GUIDES: Guide[] = [
  {
    slug: "quien-esta-conectado-a-mi-wifi",
    title: "Cómo saber quién está conectado a mi WiFi | S.S.S",
    h1: "Cómo saber quién está conectado a tu WiFi",
    description:
      "Aprende a ver todos los dispositivos conectados a tu red WiFi, a interpretar su IP, MAC y fabricante, y a decidir qué hacer cuando aparece uno que no reconoces.",
    summary:
      "Ver la lista completa de dispositivos de tu red, entender qué es cada uno y actuar cuando aparece un desconocido.",
    primaryQuery: "cómo saber quién está conectado a mi wifi",
    datePublished: "2026-08-24",
    dateModified: "2026-08-24",
    readingMinutes: 7,
    sections: [
      {
        heading: "Por qué vale la pena revisar quién está en tu red",
        body: [
          {
            kind: "p",
            text: "Un dispositivo conectado a tu WiFi no solo consume tu ancho de banda. Está dentro de tu red local, que es el lugar donde tus equipos suelen confiar unos en otros: carpetas compartidas, impresoras, cámaras, el disco duro de respaldo, el panel de administración del propio router. Muchos de esos servicios ni siquiera piden contraseña porque asumen que quien está dentro de la red tiene derecho a estar ahí.",
          },
          {
            kind: "p",
            text: "Por eso la pregunta importante no es si tu internet va lento, sino quién más tiene esa puerta abierta. Y no siempre se trata de un vecino: lo más común es encontrar equipos viejos que olvidaste, un televisor que sigue conectado, una cámara que instaló un técnico o el teléfono de alguien que estuvo de visita hace meses y quedó guardado.",
          },
        ],
      },
      {
        heading: "La forma rápida: el panel de tu router",
        body: [
          {
            kind: "p",
            text: "Todos los routers domésticos tienen una lista de los equipos conectados. Para llegar a ella escribe la dirección del router en el navegador, normalmente 192.168.1.1 o 192.168.0.1, e inicia sesión. La sección que buscas suele llamarse dispositivos conectados, clientes DHCP, device list o attached devices, según la marca.",
          },
          {
            kind: "p",
            text: "Si no sabes la dirección de tu router, la puedes averiguar desde tu computadora. En Windows abre la terminal y ejecuta ipconfig: la línea Puerta de enlace predeterminada es la dirección que necesitas. En macOS o Linux el comando equivalente es ip route o netstat -nr, y buscas la línea que empieza con default.",
          },
          {
            kind: "note",
            text: "Si nunca cambiaste la contraseña del panel de tu router, ese es un problema más urgente que cualquier dispositivo de la lista. Las credenciales de fábrica de cada modelo están publicadas en internet.",
          },
        ],
      },
      {
        heading: "Cómo leer la lista: IP, MAC y fabricante",
        body: [
          {
            kind: "p",
            text: "La lista va a mostrarte tres datos por cada equipo, y cada uno te dice algo distinto:",
          },
          {
            kind: "ul",
            items: [
              "La dirección IP (por ejemplo 192.168.1.34) es la que el router le presta al dispositivo mientras está conectado. Cambia con el tiempo, así que no sirve para identificar a nadie de forma permanente.",
              "La dirección MAC (por ejemplo A4:83:E7:1B:2C:9D) viene grabada en la tarjeta de red del equipo y es mucho más estable. Es la que sirve para reconocer al mismo dispositivo entre una revisión y otra.",
              "El nombre o fabricante sale de los primeros seis caracteres de la MAC, que identifican a la empresa que fabricó la tarjeta. Si dice Apple, Samsung o Intel, ya tienes una pista fuerte de qué equipo es.",
            ],
          },
          {
            kind: "p",
            text: "El problema práctico es que muchos routers muestran nombres inútiles como android-4f2a91 o simplemente un guión. Ahí es donde la mayoría de la gente abandona la revisión, porque tiene una lista de quince líneas y no puede decir cuál es cuál.",
          },
        ],
      },
      {
        heading: "El truco para identificar los dispositivos uno por uno",
        body: [
          {
            kind: "p",
            text: "Cuando no reconoces una entrada, el método que sí funciona es por descarte. Apaga el WiFi de un dispositivo concreto (tu teléfono, por ejemplo), espera un minuto y recarga la lista: la línea que desaparece es la de ese equipo. Anota su MAC y repite con el siguiente. Es lento la primera vez, pero solo se hace una vez: con la lista de MAC conocidas anotada, las revisiones siguientes toman segundos.",
          },
          {
            kind: "p",
            text: "También puedes ver la MAC directamente en cada equipo. En Android está en Ajustes, Información del teléfono, Estado. En iPhone, en Ajustes, General, Información, Dirección WiFi. En Windows la muestra ipconfig /all como Dirección física.",
          },
          {
            kind: "note",
            text: "Ojo con una trampa moderna: Android e iOS activan por defecto una MAC privada y aleatoria por cada red. El mismo teléfono puede aparecer con direcciones distintas en tu lista según cuándo se conectó. No es un intruso, es una función de privacidad.",
          },
        ],
      },
      {
        heading: "Qué hacer si aparece un dispositivo que no reconoces",
        body: [
          {
            kind: "p",
            text: "Antes de asumir lo peor, descarta lo aburrido: termostatos, bombillos inteligentes, el chromecast, la consola, el robot aspirador y los relojes suelen aparecer con nombres crípticos. Si después del descarte sigue habiendo algo que no cuadra, este es el orden que tiene sentido:",
          },
          {
            kind: "ul",
            items: [
              "Cambia la contraseña del WiFi. Esto expulsa a todo el mundo de una vez y te obliga a reconectar tus propios equipos, que es justamente el inventario que querías hacer.",
              "Verifica que el cifrado sea WPA2 o WPA3. Si tu router todavía está en WEP o WPA, la contraseña se rompe en minutos sin importar lo larga que sea.",
              "Desactiva el WPS. Es el botón de emparejamiento rápido y tiene fallos conocidos que permiten entrar sin la contraseña.",
              "Cambia también la contraseña de administración del router, que es distinta de la del WiFi.",
              "Considera una red de invitados para las visitas y para los dispositivos inteligentes, de modo que no compartan segmento con tus computadoras.",
            ],
          },
          {
            kind: "p",
            text: "El filtrado por MAC, que mucha gente recomienda, sirve de poco como medida de seguridad: la dirección MAC se puede falsificar en un minuto. Úsalo como orden doméstico, no como candado.",
          },
        ],
      },
      {
        heading: "El límite real de mirar el router una sola vez",
        body: [
          {
            kind: "p",
            text: "La revisión manual tiene un problema de fondo: es una foto de un instante. Te dice quién estaba conectado en el momento exacto en que abriste la página, no quién se conectó anoche a las tres de la mañana ni qué equipo apareció el martes y desapareció el miércoles. Un dispositivo que se conecta de forma intermitente es precisamente el que no vas a ver.",
          },
          {
            kind: "p",
            text: "Además, la lista del router te dice qué hay conectado, pero no qué está expuesto. Un equipo puede ser tuyo, conocido y perfectamente legítimo, y aun así tener abierto un puerto de escritorio remoto o de cámara sin contraseña. Esa es la parte que el panel del router no responde.",
          },
        ],
      },
      {
        heading: "Cómo se resuelve con S.S.S",
        body: [
          {
            kind: "p",
            text: "S.S.S automatiza justo esas dos cosas. Instalas un agente en un equipo de tu red y, desde ahí, mantiene un inventario continuo: cada dispositivo con su IP, su MAC, su fabricante y su sistema operativo, con el historial de cuándo apareció y cuándo dejó de responder. Cuando algo nuevo entra a la red, te llega una notificación en vez de tener que acordarte de revisar.",
          },
          {
            kind: "p",
            text: "El análisis corre dentro de tu red, no desde internet. El agente solo abre conexiones salientes, así que no hay que abrir puertos ni tocar la configuración del router, y la plataforma nunca tiene una vía para alcanzar tu red por su cuenta.",
          },
        ],
      },
    ],
  },
  {
    slug: "puertos-abiertos-en-mi-red",
    title: "Puertos abiertos en tu red: cómo verlos y cerrarlos | S.S.S",
    h1: "Puertos abiertos en tu red: cómo verlos y cuáles cerrar",
    description:
      "Qué significa que un puerto esté abierto, cuáles son peligrosos de verdad, cómo revisarlos con nmap y qué hacer cuando encuentras uno que no debería estar ahí.",
    summary:
      "Qué es un puerto abierto, cuáles importan de verdad y cómo revisarlos en tu propia red sin romper nada.",
    primaryQuery: "cómo ver los puertos abiertos de mi red",
    datePublished: "2026-08-24",
    dateModified: "2026-08-24",
    readingMinutes: 8,
    sections: [
      {
        heading: "Qué es un puerto y qué significa que esté abierto",
        body: [
          {
            kind: "p",
            text: "Una dirección IP identifica a un equipo dentro de la red, pero un equipo hace muchas cosas a la vez: sirve páginas, comparte archivos, acepta conexiones remotas. El puerto es el número que distingue cada uno de esos servicios. Si la IP es la dirección del edificio, el puerto es el número del apartamento.",
          },
          {
            kind: "p",
            text: "Que un puerto esté abierto significa que hay un programa escuchando detrás, listo para aceptar conexiones. Eso no es malo por sí mismo: tu impresora tiene puertos abiertos, tu televisor también, y así es como funcionan. El riesgo aparece cuando el programa que escucha es viejo, no pide contraseña, o simplemente no tenías idea de que estaba corriendo.",
          },
        ],
      },
      {
        heading: "La distinción que casi todo el mundo se salta",
        body: [
          {
            kind: "p",
            text: "Hay dos preguntas muy distintas y conviene no mezclarlas. La primera es qué puertos están abiertos dentro de tu red local, es decir, a qué puede llegar cualquier equipo que ya esté conectado a tu WiFi. La segunda es qué puertos están abiertos hacia internet, o sea a qué puede llegar cualquier persona del mundo a través de tu IP pública.",
          },
          {
            kind: "p",
            text: "El segundo caso es mucho más grave, y normalmente se produce por tres motivos: alguien configuró una redirección de puertos en el router para ver las cámaras desde afuera, el router tiene UPnP activado y una aplicación se abrió el puerto sola, o el proveedor de internet dejó expuesto el panel de administración del equipo. Revisa que UPnP esté desactivado si no lo necesitas, porque es el que abre puertos sin avisarte.",
          },
        ],
      },
      {
        heading: "Los puertos que sí deberían preocuparte",
        body: [
          {
            kind: "p",
            text: "No hace falta memorizar los sesenta y cinco mil que existen. En una red doméstica o de oficina pequeña, esta lista corta cubre casi todo lo que importa:",
          },
          {
            kind: "ul",
            items: [
              "23 (Telnet): manda la contraseña en texto plano, sin cifrar. No tiene ningún uso legítimo hoy. Si aparece abierto, casi siempre es una cámara o un router viejo, y es de los primeros que buscan las botnets.",
              "445 y 139 (SMB): compartir archivos de Windows. Expuesto hacia internet es el camino clásico del ransomware. Dentro de la red local es normal, pero conviene saber qué lo tiene abierto.",
              "3389 (RDP): escritorio remoto de Windows. Abierto hacia internet recibe intentos de contraseña de forma constante y automática.",
              "22 (SSH): acceso remoto en Linux y macOS. Es legítimo y seguro si usa llaves en vez de contraseña; deja de serlo si acepta contraseñas débiles.",
              "3306 (MySQL) y 5432 (PostgreSQL): bases de datos. No deberían estar accesibles más allá del propio servidor.",
              "554 y 8554 (RTSP): transmisión de cámaras IP. Muchísimas cámaras vienen con usuario y contraseña de fábrica y su video termina indexado en buscadores especializados.",
              "80 y 443 (HTTP y HTTPS): paneles web. Aquí lo que importa no es el puerto sino qué panel está detrás y si todavía tiene la clave que traía de fábrica.",
            ],
          },
        ],
      },
      {
        heading: "Cómo revisarlos con nmap",
        body: [
          {
            kind: "p",
            text: "nmap es la herramienta estándar para esto, es gratuita y existe para Windows, macOS y Linux. Un barrido inicial de tu propia red se hace así, ajustando el rango al de tu red:",
          },
          {
            kind: "ul",
            items: [
              "nmap -sn 192.168.1.0/24 descubre qué equipos están vivos, sin tocar sus puertos. Es el punto de partida y el más liviano.",
              "nmap -F 192.168.1.34 revisa los cien puertos más comunes de un equipo concreto. Rápido y suficiente para una primera pasada.",
              "nmap -sV 192.168.1.34 además intenta averiguar qué programa y qué versión escucha en cada puerto abierto, que es el dato que de verdad te dice si algo está desactualizado.",
            ],
          },
          {
            kind: "p",
            text: "Para saber qué tienes expuesto hacia internet, escanear desde tu propia red no sirve: verías tu red desde adentro. Hace falta mirar tu IP pública desde afuera, con un servicio externo de prueba de puertos.",
          },
          {
            kind: "note",
            text: "Escanea únicamente redes que te pertenecen o para las que tienes autorización escrita. Escanear infraestructura ajena sin permiso es delito en la mayoría de países, aunque no causes ningún daño y aunque la herramienta sea pública.",
          },
        ],
      },
      {
        heading: "Qué hacer con un puerto que no debería estar abierto",
        body: [
          {
            kind: "p",
            text: "El orden importa, porque cerrar a ciegas suele romper algo que alguien de la casa u oficina estaba usando:",
          },
          {
            kind: "ul",
            items: [
              "Averigua primero qué programa lo abrió. En Windows, netstat -ano te da el identificador del proceso y lo cruzas en el administrador de tareas. En Linux o macOS, sudo lsof -i -P -n hace lo mismo.",
              "Si el servicio no lo necesitas, desactívalo en el propio equipo. Es mucho más limpio que taparlo con una regla de firewall.",
              "Si lo necesitas pero solo dentro de casa, quita cualquier redirección de puertos que lo publique hacia internet y desactiva UPnP en el router.",
              "Si lo necesitas desde afuera, ponlo detrás de una VPN en vez de exponerlo directo. Es la diferencia entre una puerta a la calle y una puerta dentro de tu casa.",
              "Si es un dispositivo que no te deja desactivar nada (típico en cámaras baratas), cámbiale la contraseña de fábrica y muévelo a una red de invitados separada.",
            ],
          },
        ],
      },
      {
        heading: "Cómo se resuelve con S.S.S",
        body: [
          {
            kind: "p",
            text: "Correr nmap a mano funciona, pero tiene el mismo problema que revisar el router: es una foto de un momento, y hay que saber interpretar la salida. S.S.S ejecuta esos mismos escaneos desde un agente dentro de tu red, guarda el historial y te avisa cuando aparece un puerto que antes no estaba.",
          },
          {
            kind: "p",
            text: "Sobre cada servicio detectado cruza automáticamente las vulnerabilidades conocidas asociadas a esa versión, y un asistente traduce el resultado a lenguaje normal: qué es ese puerto, por qué aparece y qué conviene hacer. La restricción de solo escanear rangos privados está impuesta en el código, no es una recomendación: la plataforma no te deja apuntar a una red que no sea la tuya.",
          },
        ],
      },
    ],
  },
  {
    slug: "que-es-un-cve",
    title: "Qué es un CVE y cómo saber si te afecta | S.S.S",
    h1: "Qué es un CVE y cómo saber si alguno te afecta",
    description:
      "Qué significa un identificador CVE, cómo se lee la puntuación CVSS, por qué el catálogo KEV importa más que la severidad y cómo priorizar qué parchar primero.",
    summary:
      "Cómo leer un identificador CVE, qué significa realmente su puntuación y cómo decidir qué arreglar primero.",
    primaryQuery: "qué es un CVE",
    datePublished: "2026-08-24",
    dateModified: "2026-08-24",
    readingMinutes: 7,
    sections: [
      {
        heading: "Qué es exactamente un CVE",
        body: [
          {
            kind: "p",
            text: "CVE son las siglas de Common Vulnerabilities and Exposures. Es, sencillamente, un catálogo público que le pone un número único a cada vulnerabilidad conocida de un producto de software o hardware. Lo coordina la organización MITRE con financiamiento del gobierno de Estados Unidos, y lo usan todos: fabricantes, antivirus, escáneres y equipos de seguridad.",
          },
          {
            kind: "p",
            text: "Su valor está en que resuelve un problema de idioma. Sin CVE, un fabricante habla del fallo del módulo de compresión, un antivirus lo llama de otra forma y un boletín lo describe de una tercera. Con CVE, los tres dicen CVE-2024-3094 y todo el mundo sabe de qué se está hablando. Un CVE no es un virus ni un ataque: es la etiqueta de un defecto.",
          },
        ],
      },
      {
        heading: "Cómo se lee el identificador",
        body: [
          {
            kind: "p",
            text: "El formato es siempre el mismo: el prefijo CVE, el año en que se reservó el identificador y un número correlativo. En CVE-2024-3094, el 2024 es el año de reserva y 3094 es el correlativo.",
          },
          {
            kind: "note",
            text: "Cuidado con un malentendido frecuente: el año es el de reserva del identificador, no necesariamente el año en que se descubrió ni en que se hizo pública la vulnerabilidad. Un CVE con año viejo puede publicarse bastante después.",
          },
        ],
      },
      {
        heading: "CVSS: qué significa el número del 0 al 10",
        body: [
          {
            kind: "p",
            text: "Cada CVE recibe una puntuación CVSS, una nota del 0 al 10 que intenta resumir su gravedad técnica. Se reparte en cuatro tramos: baja de 0.1 a 3.9, media de 4.0 a 6.9, alta de 7.0 a 8.9 y crítica de 9.0 a 10.0.",
          },
          {
            kind: "p",
            text: "Ese número sale de factores como si el fallo se explota por red o hace falta estar sentado frente al equipo, cuánta complejidad tiene el ataque, si se necesitan credenciales previas y qué se pierde: confidencialidad, integridad o disponibilidad.",
          },
          {
            kind: "p",
            text: "La parte que conviene entender es que el CVSS mide gravedad teórica, no riesgo real para ti. Una vulnerabilidad crítica de 9.8 en un producto que no tienes instalado vale exactamente cero. Y una vulnerabilidad media de 5.3 en algo que tienes expuesto hacia internet puede ser tu problema más urgente. Priorizar solo por el número es el error más común.",
          },
        ],
      },
      {
        heading: "KEV: la lista que importa más que la severidad",
        body: [
          {
            kind: "p",
            text: "Existen más de doscientas mil CVE publicadas, y ninguna organización puede atenderlas todas. La agencia de ciberseguridad estadounidense CISA mantiene por eso el catálogo KEV, de Known Exploited Vulnerabilities: la lista de las vulnerabilidades que se está confirmando que los atacantes usan de verdad, ahora mismo, en ataques reales.",
          },
          {
            kind: "p",
            text: "Es una lista mucho más corta, del orden de un millar de entradas, y es el mejor filtro práctico que existe. Si un CVE que te afecta está en KEV, deja de discutir la puntuación y párchalo: hay evidencia de explotación activa. Si no está en KEV y su puntuación es media, casi siempre puede esperar al ciclo normal de actualizaciones.",
          },
        ],
      },
      {
        heading: "Cómo saber si alguno te afecta",
        body: [
          {
            kind: "p",
            text: "Un CVE te afecta cuando se cumplen tres condiciones a la vez, y las tres importan:",
          },
          {
            kind: "ul",
            items: [
              "Tienes instalado el producto afectado. Parece obvio, pero la mayoría de las alertas que la gente recibe son de software que ni siquiera usa.",
              "Tu versión cae dentro del rango vulnerable. Casi siempre el fallo afecta a versiones concretas y ya hay una posterior corregida.",
              "La configuración concreta que tienes lo hace explotable. Muchas vulnerabilidades solo aplican si una función específica está activada o si el servicio es alcanzable desde fuera.",
            ],
          },
          {
            kind: "p",
            text: "Ese cruce a mano es tedioso: hay que inventariar qué corre en cada equipo, con qué versión, y compararlo contra una base de datos que cambia todos los días. Es exactamente el tipo de tarea que conviene automatizar.",
          },
        ],
      },
      {
        heading: "Qué hacer cuando uno te afecta de verdad",
        body: [
          {
            kind: "ul",
            items: [
              "Actualizar es la respuesta correcta en la gran mayoría de los casos, y suele ser lo más rápido.",
              "Si no puedes actualizar todavía, revisa si el fabricante publicó una mitigación temporal, como desactivar la función afectada.",
              "Reduce la exposición mientras tanto: si el servicio no necesita estar accesible desde internet, quítale esa exposición y ganas tiempo sin arreglar nada.",
              "Deja constancia de la decisión. Un riesgo que se acepta a conciencia y queda escrito es una postura defendible; uno que se olvida no lo es.",
            ],
          },
        ],
      },
      {
        heading: "Cómo se resuelve con S.S.S",
        body: [
          {
            kind: "p",
            text: "S.S.S hace ese cruce por ti. A partir de los servicios y versiones que el agente detecta en tu red, busca las vulnerabilidades conocidas asociadas, muestra su puntuación CVSS y marca de forma destacada las que están en el catálogo KEV de CISA, que se sincroniza a diario. Cuando aparece una KEV nueva que toca algo de tu inventario, la notificación sale sin que tengas que ir a buscarla.",
          },
          {
            kind: "p",
            text: "La plataforma también incorpora el Top 10 de OWASP como marco de referencia, y el asistente de análisis explica cada hallazgo en lenguaje llano, para que la decisión de qué parchar primero no dependa de saber interpretar un vector CVSS.",
          },
        ],
      },
    ],
  },
];

export function findGuide(slug: string | undefined): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
