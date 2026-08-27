# Runbook: activar RLS real bajo Clerk (opcion A)

**Fecha:** 2026-07-02
**Estado:** pendiente de ejecutar. La migracion ya esta escrita en
`supabase/migrations/018_clerk_rls.sql` pero NO se ha aplicado a produccion.

## El problema en una linea

El RLS de las tablas de datos esta DESACTIVADO en la base viva. El frontend usa
la anon key (publica, va en el bundle), asi que hoy cualquiera puede leer los
datos de todos los usuarios. Esto lo arregla conectar Clerk con Supabase y
activar RLS con policies basadas en el id de Clerk (`auth.jwt()->>'sub'`).

## Orden OBLIGATORIO (no saltarse pasos)

Si activas el RLS (paso 3) antes de que el frontend mande el token de Clerk
(pasos 1 y 2), el dashboard se queda sin datos para todos. Por eso el orden es:

### Paso 1 - Conectar Clerk con Supabase (paneles, lo hace Oscar)

**En Clerk** (dashboard.clerk.com, tu app de S.S.S):
1. Menu lateral: **Configure -> Integrations** (o busca "Supabase").
2. Activa la integracion de **Supabase**.
3. Clerk te muestra tu **Clerk domain** (el "Frontend API URL" / issuer, algo como
   `https://xxxx.clerk.accounts.dev` en dev, o tu dominio Clerk de produccion).
   Copialo.

**En Supabase** (supabase.com/dashboard, proyecto `shs-app`):
1. **Authentication -> Sign In / Providers -> Third-Party Auth** (segun version:
   Project Settings -> Authentication -> Third-Party Auth).
2. **Add provider -> Clerk**.
3. Pega el **Clerk domain** del paso anterior. Guarda.
   Esto hace que Supabase acepte y valide los JWT emitidos por tu Clerk (via su
   JWKS). El claim `sub` del token es el id de Clerk del usuario (`user_...`).

> Nota: con la integracion nativa (Clerk 2025+, que es la que tienes por version
> de `@clerk/react`) NO hace falta crear un "JWT template" llamado supabase. Si
> tu panel de Clerk todavia usa el flujo viejo, la alternativa es crear un JWT
> template `supabase` y en el frontend pedir `getToken({ template: "supabase" })`.

### Paso 2 - Frontend: pasarle el token de Clerk a supabase-js

Editar `src/lib/supabase.ts`. Cambiar la creacion del cliente por:

```ts
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  // Cada request a Supabase lleva el token de Clerk del usuario logueado.
  // Si no hay sesion, devuelve null y va como anon (que ya no vera datos
  // privados una vez activo el RLS). Se pide fresco cada vez (los tokens de
  // Clerk expiran a los ~60s); NO cachear (leccion del commit a711903).
  accessToken: async () => {
    // Clerk expone la sesion en window.Clerk cuando ya cargo.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clerk = (window as any).Clerk;
    return (await clerk?.session?.getToken()) ?? null;
  },
});
```

Compilar (`npm run build`, `tsc -b` limpio) y **desplegar a Vercel**. Verificar
que el dashboard sigue funcionando (en este punto el RLS aun esta OFF, asi que
todo debe seguir viendose; lo unico nuevo es que ahora los request a Supabase
llevan el token de Clerk).

Como confirmar que el token llega bien ANTES de activar el RLS: abre la consola
del navegador logueado y corre una query cualquiera; en la pestana Network, el
request a `...supabase.co/rest/v1/...` debe llevar el header `Authorization:
Bearer eyJ...` con un token cuyo claim `sub` sea tu `user_...` de Clerk (pegalo
en jwt.io para verlo). Si en vez de eso va la anon key, algo del paso 1/2 falta.

### Paso 3 - Activar el RLS (aplicar la migracion 018)

Solo cuando el paso 2 este desplegado y verificado. Aplicar
`supabase/migrations/018_clerk_rls.sql`. Formas de hacerlo:
- **CLI:** `supabase db push` (si usas el CLI enlazado al proyecto), o
- Pegar el SQL en el **SQL Editor** del panel de Supabase y ejecutarlo, o
- Pedirmelo a mi y lo aplico via las herramientas de Supabase conectadas.

Inmediatamente despues, verificar en el dashboard (logueado como usuario normal
y como admin) que cada pagina sigue mostrando SUS datos:
- Un usuario normal ve solo lo suyo.
- El admin sigue viendo lo global (logs, reportes).
- Cerrar sesion / anon: no debe ver nada privado.

## Verificacion post-activacion

En el SQL Editor, confirmar que RLS quedo ON en todas:

```sql
select relname, relrowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
order by relname;
```

Todas las tablas de datos deben decir `relrowsecurity = true`.

## Rollback instantaneo

Si tras el paso 3 el dashboard se ve vacio o roto, NO entrar en panico: el
rollback es inmediato. Corre el bloque de `disable row level security` que esta
comentado al final de `018_clerk_rls.sql`. Eso vuelve al estado anterior (ojo:
reabre la fuga, es solo para no dejar el dashboard caido mientras se corrige lo
que haya fallado, normalmente algo del paso 1 o 2).

## Deuda que queda para despues (no bloquea esto)

- **Datos huerfanos era-UUID:** hay filas viejas con `user_id` en formato UUID
  (Supabase Auth viejo): ~297 devices, ~38 activity_logs, etc. Tras activar el
  RLS quedan invisibles (no se borran) porque no mapean a ningun login de Clerk.
  Decidir luego si se migran a un id de Clerk, se archivan o se borran.
- **Tabla `permissions` (RBAC granular):** sus 36 filas son todas era-UUID, 0 de
  Clerk. El RBAC efectivo hoy se apoya en `profiles.role`. Si se quiere el RBAC
  granular por seccion bajo Clerk, hay que repoblar `permissions` con ids Clerk.
- **`profiles` mixto:** 11 perfiles Clerk + 8 UUID viejos conviven. Limpiar los
  viejos en algun momento.
