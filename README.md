# GolazoPool

Ligas privadas de pronósticos para el Mundial de Fútbol FIFA 2026. Cada usuario entra con su correo, crea o se une a ligas por invitación, pronostica el marcador de cada partido y compite en una tabla de posiciones que se actualiza con los resultados reales.

**Demo:** https://golazopool.vercel.app

## Stack

- Next.js 16 (App Router, Server Actions)
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase: Auth por OTP, Postgres con Row Level Security, `pg_cron` y `pg_net`
- Vercel para el despliegue

## Funcionalidades

**Ligas**

- Inicio de sesión por código OTP enviado al correo y configuración inicial del perfil.
- Creación de ligas privadas y unión por código o enlace de invitación.
- Panel de administración por liga: reglas, premios, ventana de bloqueo y expulsión de miembros.

**Pronósticos**

- Vista de partidos por ronda o por fecha, incluido el cuadro de eliminatorias.
- Registro y confirmación de pronósticos, con bloqueo automático al inicio del partido o unos minutos antes.
- Reglas por liga para bloquear todo el torneo desde el primer partido y para permitir o no editar pronósticos confirmados.
- Visibilidad de los pronósticos ajenos configurable por liga: ocultos, visibles después del cierre o siempre visibles, con detalle completo o en distribución agregada.

**Resultados y posiciones**

- Marcadores en vivo, con estado de prórroga y penales.
- Puntuación con el marcador del tiempo reglamentario (90 minutos).
- Tabla de posiciones por puntaje, marcadores exactos y ganador acertado, con orden de desempates configurable por liga.
- Los equipos de las eliminatorias se asignan automáticamente a medida que se definen los grupos y los cruces.
- Carga y corrección manual de resultados para los super admins de la app.

## Arquitectura

- `src/app`: rutas del App Router. `(auth)` contiene el login, `(app)` las pantallas con sesión y `api/internal` los endpoints de sincronización.
- `src/actions`: Server Actions para ligas, pronósticos y administración.
- `src/server`: sincronización con las fuentes de datos (`flashscore`, `openfootball`) y resolución del cuadro (`tournament`).
- `src/lib`: clientes de Supabase, reglas de liga, puntuación y posiciones.
- `database`: SQL de los trabajos programados.

### Sincronización de datos

El calendario y los resultados llegan de tres fuentes, todas a través de endpoints internos protegidos con `INTERNAL_CRON_SECRET`:

| Endpoint | Fuente | Uso |
| --- | --- | --- |
| `POST /api/internal/openfootball/sync` | `openfootball/worldcup.json` | Calendario y resultados |
| `POST /api/internal/flashscore/sync?mode=live` | Página pública de Flashscore | Marcadores en vivo |
| `POST /api/internal/flashscore/sync?mode=results` | API de SportDB | Resultados finales |
| `POST /api/internal/flashscore/sync?mode=brackets` | Posiciones propias y Flashscore | Equipos de las eliminatorias |

Los trabajos de `pg_cron` que llaman a los endpoints de Flashscore están en [database/flashscore_results_cron.sql](database/flashscore_results_cron.sql). Todos aceptan `dryRun=1` para probar sin escribir.

### Seguridad

- Todas las tablas tienen Row Level Security y solo admiten usuarios con sesión.
- Una liga y sus pronósticos solo son visibles para sus miembros. La búsqueda por código de invitación y el alta de miembros pasan por el servidor.
- `SUPABASE_SERVICE_ROLE_KEY` solo se usa en servidor, en `src/lib/supabase/admin.ts`.
- El repositorio no contiene secretos: Git ignora cualquier `.env*` excepto `.env.example`, y el SQL de los cron lleva un marcador en lugar del secreto real.

## Desarrollo local

Requisitos: Node.js 20 o superior, npm y un proyecto de Supabase con el esquema de la app.

```bash
npm install
cp .env.example .env.local
npm run dev
```

La aplicación queda en `http://localhost:3000`. Otros scripts: `npm run build`, `npm run start` y `npm run lint`.

### Variables de entorno

| Variable | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública de Supabase |
| `NEXT_PUBLIC_SITE_URL` | URL pública de la app; se usa para construir los enlaces de invitación |
| `NEXT_PUBLIC_DATA_CONTROLLER_*` | Responsable del tratamiento de datos que se publica en `/privacy` |
| `NEXT_PUBLIC_DATA_PRIVACY_CONTACT` | Canal de habeas data que se publica en `/privacy` |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio, solo en servidor |
| `INTERNAL_CRON_SECRET` | Secreto que deben enviar los cron a los endpoints internos |
| `OPENFOOTBALL_WORLDCUP_JSON_URL` | URL pública o ruta local del JSON de OpenFootball |
| `SPORTDB_API_KEY` | Clave de la API de SportDB para los resultados finales |
| `SPORTDB_WORLDCUP_BASE_URL` | URL base del torneo en la API de SportDB |

### Base de datos

La app espera estas tablas en Supabase: `profiles`, `leagues`, `league_members`, `league_settings`, `teams`, `tournament_phases`, `matches`, `match_live_states`, `predictions`, `app_settings` y `app_admins`.

El repositorio todavía no incluye las migraciones del esquema ni los datos iniciales de equipos y partidos, así que levantar una instancia desde cero requiere crearlos a mano.

## Despliegue

1. Importa el repositorio en Vercel; detecta Next.js automáticamente.
2. Configura las variables de entorno en el entorno de Production.
3. En Supabase, activa `pg_cron` y `pg_net` y ejecuta los `cron.schedule(...)` de [database/flashscore_results_cron.sql](database/flashscore_results_cron.sql), reemplazando `<INTERNAL_CRON_SECRET>` por el mismo valor configurado en Vercel.

## Pendientes

- Versionar las migraciones del esquema y los datos iniciales.
- Monitoreo de los trabajos de sincronización y alternativa manual cuando una fuente falle.

## Licencia

Todos los derechos reservados. El código se publica solo para consulta y evaluación; no se permite copiarlo, modificarlo, distribuirlo ni usarlo sin autorización escrita del autor. Ver [LICENSE](LICENSE).
