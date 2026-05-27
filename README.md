# Horarios-Peluquero

Sistema de gestión de horarios para peluquerías.

## Estructura del Proyecto

- `index.html` - Aplicación principal de gestión de horarios
- `personal.html` - Gestión de personal interno
- `calendario-tienda.html` - Vista de calendario por tienda
- `reportes.html` - Módulo de reportes

## Archivos SQL (Supabase)

Scripts de configuración para la base de datos Supabase:
- `supabase_personal_setup.sql` - Configuración de tabla de personal
- `supabase_impulsadoras_pin.sql` - Sistema de PIN para impulsadoras
- `supabase_roles_setup.sql` - Configuración de roles
- `supabase_audit_setup.sql` - Sistema de auditoría
- `supabase_trigger_setup.sql` - Triggers de base de datos
- `supabase_keepalive_setup.sql` - Tabla `keepalive` para evitar pausa por inactividad

## Keepalive de Supabase

El proyecto incluye un workflow de GitHub Actions (`.github/workflows/supabase-keepalive.yml`) que inserta una fila diaria en la tabla `keepalive`.

Para activarlo:

1. Ejecuta `supabase_keepalive_setup.sql` en el SQL Editor de Supabase.
2. En GitHub, ve a **Settings > Secrets and variables > Actions** y crea este secret:
   - `SUPABASE_SERVICE_ROLE_KEY`: service role key del proyecto Supabase
3. En **Actions > Supabase Keepalive**, ejecuta manualmente **Run workflow** una vez para confirmar que inserta una fila.

El workflow apunta a `https://cectqtufttubsepyiolr.supabase.co`.
El cron corre todos los dias a las 10:35 de Ecuador (`15:35 UTC`). Nunca subas la `service_role` al repositorio.

## Despliegue en Cloudflare Pages

1. Conecta este repositorio a Cloudflare Pages
2. Configura:
   - **Build command**: (dejar vacío - es un sitio estático)
   - **Build output directory**: `/` (raíz)
3. Despliega

## Licencia

Proyecto privado.
