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

## Despliegue en Cloudflare Pages

1. Conecta este repositorio a Cloudflare Pages
2. Configura:
   - **Build command**: (dejar vacío - es un sitio estático)
   - **Build output directory**: `/` (raíz)
3. Despliega

## Licencia

Proyecto privado.
