# Guion de la entrevista tecnica individual - Proyecto Integrador II

Documento de trabajo para preparar el video individual (10-15 min) de la evaluacion final de TI3631-01-2026-3, mas la publicacion en LinkedIn y el checklist de demo. Se construye por partes entre el 4 y el 11 de agosto de 2026.

**No es un guion para leer en camara.** Es una guia de contenido: ideas, orden y datos duros, para que Oscar hable con sus palabras el dia de la grabacion (la rubrica penaliza leer diapositivas o documento).

Estado: **en construccion**. Ver seccion 0 para el plan de trabajo.

---

## 0. Plan de trabajo (4 al 11 de agosto)

| Parte | Contenido | Estado |
|---|---|---|
| 1 | Presentacion personal + presentacion del producto (problema, cliente, modelo de negocio, aporte) | **Hecho** (2026-08-04) |
| 2 | Recorrido funcional (que modulos mostrar, en que orden, guion de la demo en vivo) | Pendiente |
| 3 | Tecnologias utilizadas y por que (borrador ya posible desde CLAUDE.md) | Pendiente |
| 4 | Arquitectura y conocimientos integrados de la carrera | Pendiente |
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

Pendiente de construir en la Parte 2. Idea inicial de orden (a validar con Oscar): Dashboard -> Scan/ScanPage (el corazon del producto, nmap en vivo con NLP) -> Dispositivos conectados -> Amenazas/Vulnerabilidades -> Reportes -> Geolocalizacion de IP. Cada modulo con una frase de "esto responde a esta necesidad del cliente", no solo mostrar pantalla.

---

## 4. Tecnologias utilizadas

Borrador posible ya desde CLAUDE.md (seccion 2), falta darle forma de "justificacion para entrevista" en la Parte 3:
- Frontend: React 18 + Vite + TypeScript strict + Tailwind + shadcn/ui, en Vercel
- Backend: Express en Render
- Relay WebSocket dedicado en Fly.io (por que un relay aparte y no meter el WS en el backend)
- Supabase PostgreSQL (RLS + Realtime)
- Clerk (por que se migro de Supabase Auth a Clerk)
- Groq SDK / Llama 3.3 70B para el analisis con IA
- Resend para email

## 5. Arquitectura y conocimientos integrados

Pendiente Parte 4. El repo ya tiene el argumento central bien armado: **por que el modelo hibrido** (CLAUDE.md seccion 2.1), util para conectar con "Redes" y "Arquitectura" de la rubrica. Falta mapear explicitamente cada materia (Ingenieria de Software, Analisis y Diseño de Sistemas, Bases de Datos, Redes, Seguridad, Calidad de Software, Gestion de Proyectos, Arquitectura, IA) a una decision concreta del proyecto.

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
