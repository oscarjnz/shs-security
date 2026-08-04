# Guion de la entrevista tecnica individual - Proyecto Integrador II

Documento de trabajo para preparar el video individual (10-15 min) de la evaluacion final de TI3631-01-2026-3, mas la publicacion en LinkedIn y el checklist de demo. Se construye por partes entre el 4 y el 11 de agosto de 2026.

**No es un guion para leer en camara.** Es una guia de contenido: ideas, orden y datos duros, para que Oscar hable con sus palabras el dia de la grabacion (la rubrica penaliza leer diapositivas o documento).

Estado: **en construccion**. Ver seccion 0 para el plan de trabajo.

---

## 0. Plan de trabajo (4 al 11 de agosto)

| Parte | Contenido | Estado |
|---|---|---|
| 1 | Presentacion personal + presentacion del producto (problema, cliente, modelo de negocio, aporte) | **Hecho** (2026-08-04) |
| 2 | Recorrido funcional (que modulos mostrar, en que orden, guion de la demo en vivo) | **Hecho** (2026-08-04) |
| 3 | Tecnologias utilizadas y por que (borrador ya posible desde CLAUDE.md) | **Hecho** (2026-08-04) |
| 4 | Arquitectura y conocimientos integrados de la carrera | **Hecho** (2026-08-04) |
| 5 | Reflexion final (100% personal, requiere la voz de Oscar) | Pendiente |
| 6 | Publicacion LinkedIn (texto + lista de capturas necesarias) | Pendiente |
| 7 | Checklist tecnico de demo (URL, usuario/contraseña de prueba, verificar que Render/Supabase no esten dormidos el dia de grabacion) | Pendiente |
| 8 | Documento tecnico actualizado (revisar que este al dia en el repo) | Pendiente |

---

## 1. Presentacion personal

- Nombre completo: Oscar Osnarci Jimenez Peguero
- Grupo: TI3631-01-2026-3
- Proyecto: S.S.S - Security Smart Services (aparece tambien como S.H.S - Security Home Services, nombre legacy)

**Borrador hablado (referencia para internalizar, no para leer):**

> Buenas, mi nombre es Oscar Osnarci Jimenez Peguero, soy del grupo TI3631-01-2026-3, y el proyecto que voy a presentarles hoy es S.S.S, Security Smart Services. Dentro del equipo mi rol fue, digamos, el lado tecnico mas pesado del proyecto: todo lo que es backend, el despliegue en la nube, la infraestructura, la autenticacion, el agente que corre en la maquina del usuario, el relay que conecta ese agente con la nube, y los instaladores para que la gente pueda poner esto a correr en su computadora sin complicarse la vida. Practicamente fui el que se encargo de que todo esto, que ya de por si es un sistema hibrido bastante particular, funcionara de verdad en produccion y no se quedara solo en el papel.

**Estado:** completo, ajustar tono libremente el dia de grabacion.

---

## 2. Presentacion del producto

### Que problema resuelve
Las redes domesticas y de pequeñas empresas no tienen visibilidad de que dispositivos estan conectados, que puertos estan abiertos, ni si hay vulnerabilidades conocidas (CVE) expuestas. Las herramientas tipo SIEM real son caras y complejas, pensadas para empresas grandes con equipo de seguridad dedicado. S.S.S es un SIEM simplificado: el usuario pregunta en lenguaje natural, un agente local corre nmap/ping/traceroute dentro de su propia red, y una IA analiza los resultados y genera alertas entendibles.

### Quien es el cliente
Dos publicos, con el mismo problema de fondo pero distinto nivel de profundidad:
- **Personas en general, sin mucho conocimiento tecnico**, que quieren saber que esta pasando en su propia red domestica: cuantos dispositivos estan conectados, si hay algo raro, si su router tiene puertos abiertos que no deberian.
- **Pequeñas y medianas empresas**, con el mismo enfoque de "quiero saber que pasa en mi red", pero mas orientado a seguridad: deteccion de amenazas, vulnerabilidades, reportes que puedan mostrarle a alguien.

**Borrador hablado:**

> El cliente de S.S.S en realidad son dos: por un lado esta la persona comun, que no tiene por que saber de redes ni de seguridad, pero quiere entender que esta pasando en su wifi de su casa. Y por otro lado estan las pequeñas y medianas empresas, que tienen ese mismo interes pero con un enfoque mas serio de seguridad: saber si hay amenazas, si hay vulnerabilidades, y tener un reporte que puedan revisar.

### Cual es el modelo de negocio
Hoy en dia no hay un modelo de negocio activo, el proyecto no se ha lanzado comercialmente. Para la entrevista se define como una **direccion propuesta, no una decision ya tomada**: un SaaS por suscripcion, con un tier gratuito basico (dashboard, escaneo limitado, monitoreo de un numero pequeño de dispositivos) y un tier de pago para pequeñas empresas con mas capacidad (mas dispositivos, reportes automaticos periodicos, alertas configurables, retencion de historial mas larga). Si en la entrevista preguntan si esto ya se vende, la respuesta honesta es que no, que es la direccion que se le ve al proyecto pero todavia no se ha formalizado ni lanzado.

**Borrador hablado:**

> Ahorita mismo el proyecto no tiene un modelo de negocio activo porque no se ha lanzado comercialmente, esto es un proyecto academico. Pero si me preguntan como yo lo veria escalando, la idea mas natural seria un SaaS por suscripcion: un plan gratuito bien basico para el usuario de casa, y un plan de pago para las pequeñas empresas que necesiten monitorear mas dispositivos, tener reportes automaticos y alertas configurables.

### Cual fue el aporte de Oscar dentro del proyecto
Enfocado en backend, despliegue, infraestructura cloud, autenticacion, scanner-agent, relay e instaladores (que es donde realmente estuvo el trabajo). Material real del repo para desarrollarlo con confianza:
- **Diseño del modelo hibrido nube+local**: el agente local mantiene solo conexiones salientes (WSS:443), sin abrir puertos ni pedir reglas de firewall, para poder auditar una red privada desde una arquitectura que vive en la nube.
- **Encontrar y cerrar una fuga de datos real en produccion**: el RLS de Supabase no protegia a los usuarios despues de la migracion a Clerk (`auth.uid()` quedaba en NULL porque el frontend nunca mandaba el JWT de Clerk a Supabase), asi que cualquiera con la anon key publica podia leer los datos de todos los usuarios. Se diagnostico, se decidio la arquitectura correcta (integracion nativa Clerk-Supabase con JWT, reescribir las policies para usar `auth.jwt()->>'sub'`) y se aplico en produccion sin tumbar el servicio.
- **Migracion completa de Supabase Auth a Clerk**, incluyendo el detalle no trivial de que los IDs de Clerk no son UUID, hubo que migrar columnas a TEXT en varias tablas.
- **Instaladores multiplataforma del scanner-agent** (Windows con Tarea Programada, macOS con firma ad-hoc, Linux con systemd), manejo de versionado unificado, releases publicados en GitHub.
- **Relay WebSocket dedicado en Fly.io**: la pasarela que conecta los agentes locales de los usuarios con el backend en la nube, con su propia capa de resiliencia (reaper de conexiones muertas, limite de payload, manejo de errores para que un mensaje malo de un agente no tumbe a todos los demas).
- **Owner unico de toda la infraestructura cloud gratuita** (Vercel, Render, Fly.io, Supabase), resolviendo una por una las restricciones del free tier: hibernacion de Render cada 15 min, pausa de Supabase a los 7 dias de inactividad, limite de 12 funciones serverless de Vercel Hobby.

**Borrador hablado:**

> Mi aporte se concentro sobre todo en la parte de backend, despliegue e infraestructura. Yo diseñe el modelo hibrido del proyecto, osea, como un servicio en la nube puede auditar una red privada sin poder tocarla directamente, que es resolver eso con un agente local que solo hace conexiones salientes. Tambien fui yo el que levanto toda la infraestructura en la nube, desde Vercel hasta Supabase pasando por un relay de WebSocket en Fly.io, maneje la autenticacion completa con Clerk, y construi los instaladores para que el agente se pueda poner a correr en Windows, macOS y Linux. Y de hecho, uno de los momentos que mas me marco fue cuando, verificando la seguridad de la base de datos, me di cuenta de que habia una fuga real: cualquiera con la clave publica del proyecto podia leer los datos de todos los usuarios, porque las politicas de seguridad de la base de datos se habian quedado pensadas para el sistema de autenticacion viejo. Tuve que diagnosticar eso, decidir la arquitectura correcta para arreglarlo, y aplicarlo en produccion sin tumbar el servicio.

**Estado:** completo, ajustar tono libremente el dia de grabacion. Nota: al hablar del aporte, evitar frases que suenen a "el equipo no hizo nada"; la pregunta de la rubrica es sobre el aporte individual, no hace falta compararse con los demas.

---

## 3. Recorrido funcional (demo en vivo)

**Presupuesto de tiempo:** el video completo son 10-15 min repartidos en 6 bloques (personal, producto, demo, tecnologias, arquitectura, reflexion). La demo vale 4 de los 20 puntos (menos que dominio y tecnologias), asi que no debe comerse el video: **apuntar a 3-4 minutos**, no mas. Mejor 5 paradas bien explicadas que 10 pantallas pasadas rapido.

**Regla de oro para cada parada:** no es "mira, esta es la pantalla de X". Es "esto existe porque el cliente necesita Y, y aqui se ve como se resuelve". Una frase de necesidad antes de tocar la pantalla, no despues.

### Orden recomendado (5 paradas)

1. **Dashboard** (30-40 seg). Es el aterrizaje: KPIs en tiempo real, estado general de la red. Frase de entrada: *"cuando el usuario entra, lo primero que quiere saber es: ¿esta todo bien ahora mismo?, y eso es exactamente lo que responde el dashboard"*. No profundizar en cada grafica, solo pasar la vista.

2. **Scan / ScanPage** (1-1.5 min, la parada mas larga porque es el diferenciador real del producto). Escribir un pedido en lenguaje natural (ej. "escanea los dispositivos de mi red" o un perfil predefinido), mostrar el resultado llegando en vivo. Aqui es donde se menciona, sin meterse todavia en detalle tecnico (eso es la Parte 4), que detras de esto hay un agente corriendo nmap de verdad en la maquina del usuario, no un dato inventado. Frase de entrada: *"esto es el corazon del producto: el usuario no tiene que saber usar nmap, se lo pide en español normal"*.

3. **Dispositivos conectados** (30 seg). Mostrar la lista de dispositivos detectados, con MAC/fabricante/SO cuando se pueda. Frase de entrada: *"de ese escaneo sale esto: quien esta conectado a mi red ahora mismo, sin que yo tenga que ir a revisar el router a mano"*.

4. **Amenazas y Vulnerabilidades** (40-50 seg, las dos paginas juntas, rapido). Mostrar severidad y algun CVE real si hay data cargada. Frase de entrada: *"aqui es donde el producto deja de ser solo informativo y empieza a avisar: si hay una amenaza detectada, o una vulnerabilidad conocida expuesta, aparece aqui con su nivel de severidad"*.

5. **Reportes** (30-40 seg). Generar o mostrar un reporte ya generado, mencionar el envio por email. Frase de entrada: *"y al final, para una pequeña empresa esto tiene que salir de la pantalla: un reporte que se pueda mandar o guardar como evidencia"*.

### Que dejar fuera del recorrido en vivo (por tiempo, no porque no exista)
Geolocalizacion de IP, Pulse, Notificaciones, Usuarios/RBAC, Configuracion, ACi, pagina de Escaneres. Si sobra tiempo se puede mencionar de pasada ("tambien hay geolocalizacion de IP, monitoreo de disponibilidad tipo ping periodico, y gestion de permisos por rol, pero no me voy a meter en cada una para no alargarme") en vez de mostrarlas, eso demuestra dominio sin gastar minutos.

### Nota logistica importante
Verificar la Parte 7 (checklist tecnico) ANTES de grabar: que el scanner-agent este online o usar el modo demo (`/demo`) para que el escaneo en vivo no salga vacio o tardado por Render dormido.

---

## 4. Tecnologias utilizadas

**Presupuesto de tiempo:** 2-3 min. No es leer una lista de tecnologias, es explicar **por que cada una y que resuelve**, que es lo que pide la rubrica (5 de los 20 puntos, el segundo criterio con mas peso).

### Frontend: React 18 + Vite + TypeScript strict + Tailwind + shadcn/ui, en Vercel
- **Por que:** React porque el dashboard es una app con muchisimo estado en tiempo real (KPIs, listas que cambian solas via Supabase Realtime), y el modelo de componentes de React se presta natural para eso.
- **Vite en vez de Create React App:** arranque de dev server y hot reload casi instantaneo, importante cuando se itera rapido sobre 14 paginas distintas.
- **TypeScript en modo strict:** en un proyecto de seguridad, un error de tipos no es cosmetico, puede significar que un dato sensible se trate mal. La leccion real de esto: los IDs de Clerk no son UUID, son TEXT, y TypeScript strict ayudo a no dejar pasar esa clase de descuido silenciosamente.
- **Tailwind + shadcn/ui:** en vez de reinventar 45 componentes de UI (botones, dialogs, tablas), shadcn da primitivos accesibles y personalizables, y Tailwind mantiene consistencia visual sin escribir CSS a mano en cada pantalla.
- **Vercel:** deploy automatico desde `main`, CDN global, cero configuracion de servidor para el frontend.

### Backend: Express + Node.js, en Render
- **Por que Express:** simple, maduro, ideal para exponer una API REST mas streaming SSE (los resultados del escaneo llegan en vivo al frontend por Server-Sent Events, no por polling).
- **Por que Render:** tiene un free tier funcional para un proyecto academico, soporta cron jobs (el pulse de dispositivos corre cada 60 seg) y despliega directo desde el repo.
- **El costo real de esa decision:** Render free hiberna a los 15 min de inactividad, y eso obligo a construir mitigaciones (keep-alive interno, cron externo) para que la demo no se quede "dormida" cuando alguien la prueba. Es un ejemplo real de disenar para las limitaciones de la infraestructura, no ignorarlas.

### Relay WebSocket dedicado, en Fly.io
- **Por que un servicio aparte y no meter el WebSocket dentro del backend de Express:** las conexiones WebSocket son de larga duracion y con estado (cada agente local mantiene una conexion abierta todo el tiempo), mientras que la API REST es de request/response corto. Mezclar eso en el mismo proceso significa que un problema en un lado puede tumbar el otro. Separarlos aisla el riesgo: si el relay tiene un problema, la API y el dashboard siguen funcionando.
- **Por que Fly.io especificamente:** permite elegir la region (Miami, cerca de RD) para minimizar latencia de los agentes conectandose, y corre bien en una instancia pequeña (1 vCPU, 256 MB) para un proyecto sin presupuesto de infraestructura.

### Supabase (PostgreSQL) con RLS y Realtime
- **Por que PostgreSQL:** los datos del proyecto son fuertemente relacionales (dispositivos, amenazas, escaneos, usuarios, permisos), y necesitan integridad referencial real, no un documento suelto.
- **Row Level Security:** la seguridad de "cada usuario solo ve sus datos" vive en la base de datos, no solo en el codigo del frontend. Esto es defensa en profundidad: aunque alguien manipule el cliente, la base de datos igual filtra.
- **Realtime:** el dashboard se actualiza solo cuando hay un evento nuevo (una amenaza, un dispositivo), sin que el frontend tenga que estar preguntando "¿hay algo nuevo?" cada pocos segundos.

### Clerk para autenticacion
- **Por que:** construir autenticacion desde cero (manejo de contraseñas, sesiones, OAuth, recuperacion de cuenta) es una superficie de ataque enorme y facil de hacer mal. Clerk es un proveedor especializado que ya resolvio eso de forma segura, y da login social, verificacion, y manejo de sesiones listos para usar.
- **Integracion:** el token de Clerk se pide fresco en cada peticion (no se cachea) y, mas importante, se integro nativamente con Supabase para que las politicas de RLS puedan leer la identidad real del usuario logueado.

### Groq SDK con Llama 3.3 70B para el analisis con IA
- **Por que Groq:** corre inferencia sobre hardware especializado (LPU) que responde muchisimo mas rapido que la inferencia tradicional en GPU, lo cual importa cuando el usuario esta chateando con el asistente o pidiendole que interprete un escaneo, la latencia se nota.
- **Por que un modelo abierto como Llama 3.3:** costo accesible para un proyecto academico sin presupuesto, comparado con modelos cerrados mas caros.
- **Uso real:** interpretar resultados de escaneo en lenguaje natural, y el chat de analisis de seguridad.

### Resend para email transaccional
- **Por que:** API moderna y simple para mandar los reportes por correo y las notificaciones, sin tener que lidiar con configurar un servidor SMTP propio.

**Borrador hablado (hilo conector, no para leer palabra por palabra):**

> La arquitectura tiene un frontend en React con Vite y TypeScript en modo estricto, con Tailwind y shadcn para no reinventar componentes de UI, desplegado en Vercel. El backend es Express corriendo en Render, que expone la API y tambien manda los resultados del escaneo en vivo por streaming. Aparte de eso hay un servicio dedicado solo para las conexiones WebSocket, corriendo en Fly.io, porque las conexiones de los agentes locales son de larga duracion y no quise mezclar eso con la API principal, para que si algo falla en un lado no tumbe el otro. Los datos viven en Supabase, que es PostgreSQL con seguridad a nivel de fila, o sea que la proteccion de que cada usuario vea solo lo suyo esta en la base de datos, no solo en el codigo del frontend. La autenticacion la maneja Clerk, porque construir eso desde cero es un riesgo de seguridad que no vale la pena correr. Y para el analisis con inteligencia artificial uso Groq con Llama 3.3, que es rapidisimo respondiendo, cosa que en un chat se nota mucho.

## 5. Arquitectura y conocimientos integrados

**Presupuesto de tiempo:** 2-3 min. No hace falta hablar de las 9 materias por separado con el mismo peso, mejor agrupar y elegir el argumento mas fuerte de cada una. La columna a la derecha es lo que decir en camara para cada materia, con un ejemplo real y verificable en el repo (no generico).

| Materia | Decision concreta del proyecto |
|---|---|
| **Arquitectura** | El modelo hibrido nube+local: un servicio en la nube no puede alcanzar dispositivos detras de un router, asi que la unica forma de auditar una red privada es tener algo corriendo dentro de ella. Se resolvio con un agente local que solo abre conexiones salientes (WSS:443), sin exigir reglas de firewall ni exponer puertos. Es una decision de arquitectura obligada por una restriccion de red real, no un capricho tecnico. |
| **Redes** | Todo el producto es sobre redes: rangos privados (`192.168.x.x`, `10.x.x.x`, `172.16-31.x.x`), escaneo de puertos con nmap, ping, traceroute, resolucion DNS. Y a nivel de transporte, entender por que WebSocket (conexion persistente bidireccional) es lo correcto para que el agente reciba comandos en tiempo real, en vez de HTTP tradicional con polling. |
| **Seguridad** | Dos ejemplos fuertes y reales: (1) el hallazgo y cierre de la fuga de RLS con Clerk, ya cubierto en la Parte 1. (2) la sanitizacion del scanner: whitelist de comandos permitidos (nmap, ping, traceroute, arp, dig, nslookup, whois), prohibicion de caracteres de inyeccion de shell (`;`, `\|`, backtick, `$`), rate limiting, y el contenedor del agente corriendo como usuario no-root. Es aplicar el principio de menor privilegio en cada capa. |
| **Bases de Datos** | Modelo relacional en PostgreSQL (Supabase) con mas de 18 migraciones versionadas, Row Level Security como capa de seguridad a nivel de fila, y Realtime para no depender de polling. Un caso de diseño real: cuando se migro de Supabase Auth a Clerk, los IDs de usuario tuvieron que pasar de UUID a TEXT en varias tablas, porque Clerk usa su propio formato de ID, eso fue una decision de modelado de datos con impacto en produccion. |
| **Analisis y Diseño de Sistemas** | El sistema de permisos (RBAC): tres roles (admin, normal, guest) sobre nueve secciones del sistema, cada combinacion con tres niveles de acceso (ninguno, ver, completo). Traducir el requerimiento de negocio ("no todos deben ver ni hacer lo mismo") en un modelo de datos y una capa de validacion consistente en cada endpoint. |
| **Ingenieria de Software** | Convenciones de codigo explicitas y sostenidas (TypeScript strict, patrones repetibles de `requireAuth` + `requirePermission` + `validateBody` en cada endpoint nuevo), control de versiones con Git, y una practica poco comun pero real: un archivo de memoria del proyecto (`CLAUDE.md`) que documenta decisiones, errores y por que se tomaron, para no repetir los mismos errores dos veces. |
| **Calidad de Software** | Rondas de auditoria dedicadas (no solo programar features): una sesion completa de revision de bugs y performance en backend, frontend y el relay, identificando y corrigiendo cosas como fugas de memoria en rate-limiting, condiciones de carrera, y falta de limites de tamaño en payloads, antes de seguir sumando funcionalidades nuevas. |
| **Gestion de Proyectos** | Equipo de 4 con roles definidos, entregas incrementales por fases (documentadas en `docs/plan-despliegue-semana6.md` y el roadmap del propio `CLAUDE.md`), y decisiones tomadas explicitamente y por escrito en vez de quedar solo en una conversacion de chat. |
| **Inteligencia Artificial** | Integracion de un LLM (Llama 3.3 via Groq) para dos casos de uso reales, no decorativos: interpretar pedidos de escaneo en lenguaje natural y traducirlos a comandos validos, y un chat de analisis que interpreta los resultados de seguridad para alguien sin conocimiento tecnico. |

**Borrador hablado (resumen, elegir 4-5 filas para decir en camara, no las 9):**

> Este proyecto toca bastantes areas de la carrera, pero si tuviera que resaltar las mas fuertes: en arquitectura, la decision central fue el modelo hibrido nube-local, porque un servicio en la nube fisicamente no puede llegar a un dispositivo detras de un router, entonces hubo que resolver eso con un agente que corre dentro de la red del usuario y solo abre conexiones salientes. En seguridad, aparte de la fuga de RLS que ya mencione, el scanner tiene una capa de sanitizacion completa: lista blanca de comandos permitidos, bloqueo de caracteres de inyeccion, rate limiting, y el agente corriendo sin privilegios de administrador. En bases de datos, el modelo esta en PostgreSQL con seguridad a nivel de fila y mas de dieciocho migraciones versionadas. Y en inteligencia artificial, el LLM no es un adorno, se usa para que el usuario pueda pedir un escaneo en español normal y para interpretar los resultados de seguridad sin tener que entender de redes.

## 6. Reflexion final

100% personal, no se puede prellenar. Preguntas de la rubrica: que fue lo mas importante que aprendio, que mejoraria con mas tiempo, se sentiria preparado para presentar esto a un cliente real y por que.

---

## 7. LinkedIn

Pendiente Parte 6. Requisitos minimos de la rubrica: nombre del proyecto, descripcion breve, problema que resuelve, tecnologias, rol de Oscar, capturas/imagenes, enlace al demo. Mas: agregar y etiquetar a la profesora.

## 8. Checklist tecnico de demo

Pendiente Parte 7. Debe quedar resuelto ANTES del dia de grabacion:
- URL del sistema en produccion funcionando
- Usuario y contraseña de prueba (crear un usuario demo dedicado, no uno personal)
- Confirmar que Render no este hibernado justo al momento de grabar/evaluar
- Confirmar que Supabase no este pausado
- Al menos un scanner-agent online para que la demo de escaneo no salga vacia (o usar el modo demo cloud que ya existe en `/demo`)

---

## 9. Camino final: paso a paso hasta la entrega (individual, video en Teams)

Esto es 100% individual: **un solo estudiante hablando, un solo video**. Nadie mas del equipo aparece en camara, en audio, ni de fondo. Aunque el proyecto es de 4 personas, esta entrega evalua solo a Oscar.

1. **Terminar el guion completo** (Partes 3 a 6 que faltan: tecnologias, arquitectura/conocimientos de la carrera, reflexion final). Se sigue construyendo aqui mismo, por partes, en las proximas sesiones.
2. **Ensayar en voz alta, cronometrado**, sin leer el documento. El objetivo no es memorizar palabra por palabra, es dominar las ideas para poder decirlas con naturalidad y ajustarse al tiempo (10-15 min). Repetir hasta que salga fluido sin mirar el guion.
3. **Correr el checklist tecnico de la Parte 8** el mismo dia o la vispera de grabar: URL de produccion viva, usuario/contraseña de prueba dedicados (no personales), Render y Supabase despiertos, al menos un scanner-agent online o listo el modo `/demo`.
4. **Preparar el espacio de grabacion**: buena luz, buen audio, sin ruido de fondo, sin nadie mas entrando al cuadro ni hablando. Camara y pantalla compartida listas.
5. **Grabar en Microsoft Teams** (la rubrica pide especificamente el link de grabacion individual en Teams):
   - Iniciar una reunion de Teams solo (por ejemplo "Reunion ahora"), activar la grabacion, compartir pantalla con la app y activar camara.
   - Grabar de corrido si se puede; si hay que hacer tomas, dejarlo editado para que se vea como una sola pieza fluida.
   - Verificar que la duracion final quede entre 10 y 15 minutos.
   - Al terminar, confirmar que Teams genero el link de la grabacion y que el permiso de acceso es el que pide Blackboard (que se pueda ver sin pedir acceso adicional).
6. **Revisar la grabacion una vez completa**: audio claro, se ve bien, no aparece nadie mas, no se esta leyendo un guion o diapositiva en pantalla.
7. **Publicar en LinkedIn**, seccion Proyectos del perfil: nombre del proyecto, descripcion breve, problema que resuelve, tecnologias, rol de Oscar, capturas del sistema, enlace al demo. Agregar a la profesora como contacto y etiquetarla en la publicacion.
8. **Confirmar que el documento tecnico del repositorio esta actualizado** (Parte 8 de este plan de trabajo, seccion 8).
9. **Reunir los 6 entregables para Blackboard**:
   - Link de la grabacion individual en Teams
   - Link de la publicacion en LinkedIn
   - Link del demo funcionando en produccion
   - Usuario y contraseña de prueba del demo
   - Link del repositorio del proyecto (GitHub)
   - Documento tecnico actualizado
10. **Subir todo a Blackboard antes de la fecha limite** (confirmar la hora exacta de corte, no solo el dia).

**Nota de tiempo:** hoy es 4 de agosto, la entrega es el 11. Sugerido (flexible, se ajusta segun como avancemos el guion): guion completo y ensayado para el 8-9 de agosto, grabacion y LinkedIn el 9-10, y el 11 solo de colchon por si algo falla (Render dormido, Teams con problemas, etc.), no para hacerlo todo de ultimo momento.
