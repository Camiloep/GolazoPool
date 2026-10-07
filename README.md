# GolazoPool

GolazoPool es una app web para manejar ligas privadas de pronosticos del Mundial de Futbol FIFA 2026. Cada usuario entra por correo, completa su perfil, se une a ligas por invitacion y registra marcadores por partido.

## Stack

- Next.js 16 con App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase Auth + Postgres
- ESLint
- npm

## Requisitos

- Node.js 20 o superior
- npm
- Un proyecto de Supabase configurado
- El esquema base de la app cargado en la base de datos

## Variables de entorno

Copia `.env.example` a `.env.local` y completa los valores de tu proyecto:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_DATA_CONTROLLER_NAME=
NEXT_PUBLIC_DATA_CONTROLLER_EMAIL=golazopool@gmail.com
NEXT_PUBLIC_DATA_CONTROLLER_PHONE=
NEXT_PUBLIC_DATA_CONTROLLER_ADDRESS=
NEXT_PUBLIC_DATA_PRIVACY_CONTACT=golazopool@gmail.com
SUPABASE_SERVICE_ROLE_KEY=
OPENFOOTBALL_WORLDCUP_JSON_URL=https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json
INTERNAL_CRON_SECRET=
```

`NEXT_PUBLIC_SITE_URL` se usa para construir links de invitacion y debe apuntar a la URL publica correcta en cada ambiente.
`NEXT_PUBLIC_DATA_CONTROLLER_*` y `NEXT_PUBLIC_DATA_PRIVACY_CONTACT` publican en `/privacy` el responsable del tratamiento y el canal de habeas data para esa instancia. Si no defines el correo publico, la pagina usa `golazopool@gmail.com` como contacto por defecto.

`SUPABASE_SERVICE_ROLE_KEY` solo se usa en servidor para sincronizar el calendario global desde OpenFootball.
`OPENFOOTBALL_WORLDCUP_JSON_URL` acepta una URL publica o una ruta local relativa al proyecto, por ejemplo `worldcup.json`.
`INTERNAL_CRON_SECRET` protege el endpoint interno que puedes usar desde un cron.

Git ya ignora `.env`, `.env.local` y cualquier otro `.env*` con secretos reales.

## Desarrollo local

```bash
npm install
npm run dev
```

Abre `http://localhost:3000` para ver la aplicacion.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Funcionalidades actuales

- Login por OTP/email con Supabase.
- Setup inicial de perfil.
- Creacion de ligas privadas.
- Union a ligas por codigo de invitacion.
- Vista de partidos por ronda o por fecha.
- Registro y confirmacion de pronosticos.
- Bloqueo automatico de pronosticos al inicio del partido o algunos minutos antes.
- Reglas por liga con switches para bloquear todo el mundial desde el primer partido y permitir o no editar picks confirmados.
- Regla por liga para ocultar los picks en toda la liga, mostrarlos solo despues del cierre o dejarlos siempre visibles, con detalle completo, solo quienes ya pronosticaron o en distribucion agregada.
- Orden de desempates configurable por liga para la tabla de posiciones.
- Ranking por puntaje, exactos y ganador.
- Panel de administracion por liga para reglas, premios y ventana de bloqueo.
- Regla global para permitir o bloquear correcciones de resultados oficiales una vez cerrados.
- Carga manual de resultados para super admins de la app.
- Sync manual o por cron del calendario y resultados desde `openfootball/worldcup.json`.

## Base de datos

La app asume que en Supabase ya existen al menos estas tablas:

- `profiles`
- `leagues`
- `league_members`
- `teams`
- `matches`
- `predictions`

Para todas las funciones administrativas tambien espera estas tablas adicionales:

- `league_settings`
- `app_settings`
- `app_admins`

Hoy el repo no incluye migraciones SQL versionadas dentro de `database/`. Si vas a levantar el proyecto desde cero o desplegarlo en otro ambiente, conviene versionar esas migraciones y los seeds de equipos/partidos antes de compartirlo.

## Despliegue en Vercel

1. Sube este repositorio a GitHub.
2. Crea un nuevo proyecto en Vercel e importa el repositorio.
3. Vercel detectara Next.js automaticamente.
4. Configura las mismas variables de entorno en Vercel.
5. Usa `npm run build` como comando de build y deja la salida por defecto.

## Pendientes sugeridos

- Versionar migraciones SQL del schema y seeds iniciales.
- Monitoreo del cron que sincroniza OpenFootball y fallback manual cuando el feed no refleje cambios.
