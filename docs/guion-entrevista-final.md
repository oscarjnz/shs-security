# Guion de la entrevista tecnica individual - Proyecto Integrador II

Documento de trabajo para preparar el video individual (10-15 min) de la evaluacion final de TI3631-01-2026-3, mas la publicacion en LinkedIn y el checklist de demo. Se construye por partes entre el 4 y el 11 de agosto de 2026.

**No es un guion para leer en camara.** Es una guia de contenido: ideas, orden y datos duros, para que Oscar hable con sus palabras el dia de la grabacion (la rubrica penaliza leer diapositivas o documento).

Estado: **en construccion**. Ver seccion 0 para el plan de trabajo.

---

## 0. Plan de trabajo (4 al 11 de agosto)

| Parte | Contenido | Estado |
|---|---|---|
| 1 | Presentacion personal + presentacion del producto (problema, cliente, modelo de negocio, aporte) | Pendiente respuesta de Oscar |
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
- Rol en el equipo: **PENDIENTE que Oscar lo diga con sus palabras.** Lo que ya sabemos por el repo (CLAUDE.md seccion 10): backend, despliegue, infraestructura cloud, autenticacion, scanner-agent, relay e instaladores multiplataforma. En la practica, lead tecnico del proyecto y owner unico de los paneles cloud (Vercel, Render, Fly.io, Supabase).

---

## 2. Presentacion del producto

### Que problema resuelve
Borrador desde el repo: las redes domesticas y de pequeñas empresas no tienen visibilidad de que dispositivos estan conectados, que puertos estan abiertos, ni si hay vulnerabilidades conocidas (CVE) expuestas. Las herramientas tipo SIEM real son caras y complejas, pensadas para empresas grandes con equipo de seguridad dedicado. S.S.S es un SIEM simplificado: el usuario pregunta en lenguaje natural, un agente local corre nmap/ping/traceroute dentro de su propia red, y una IA analiza los resultados y genera alertas entendibles.

### Quien es el cliente
**PENDIENTE, pregunta directa a Oscar.** Necesito que me digas en tus palabras: es una pequeña empresa sin equipo de IT dedicado, un hogar con varios dispositivos IoT, ambos, u otro publico que ustedes definieron en la propuesta original del proyecto.

### Cual es el modelo de negocio
**PENDIENTE.** No hay ningun documento en el repo que defina esto (revise `docs/` y `PROMPT_CLAUDECODE.md`, ninguno lo cubre). Necesito que me digas si la propuesta original del equipo definio algo tipo SaaS por suscripcion, freemium, licencia por dispositivo, o si esto quedo abierto y hay que proponerlo ahora para la entrevista.

### Cual fue el aporte de Oscar dentro del proyecto
**PENDIENTE**, pero con material de sobra para armarlo desde el repo una vez me confirmes el enfoque que quieres darle. Candidatos fuertes segun el historial real de trabajo:
- Cerrar una fuga de datos real (RLS de Supabase no protegia a los usuarios bajo Clerk, cualquiera con la anon key podia leer datos de todos los usuarios). Diagnostico, decision de arquitectura (integracion Clerk-Supabase con JWT nativo) e implementacion en produccion. Es una historia de "encontre un problema de seguridad grave y lo resolvi con criterio", exactamente lo que una entrevista tecnica quiere escuchar.
- Diseño del modelo hibrido nube+local (agente local con conexiones salientes unicamente, sin abrir puertos) para poder auditar redes privadas desde una arquitectura en la nube.
- Instaladores multiplataforma del scanner-agent (Windows/macOS/Linux), manejo de versionado, releases en GitHub.
- Migracion completa de Supabase Auth a Clerk.
- Owner de toda la infraestructura cloud gratuita (Vercel, Render, Fly.io, Supabase) con las restricciones de free tier resueltas una por una (hibernacion de Render, pausa de Supabase, limite de 12 funciones serverless de Vercel Hobby).

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
