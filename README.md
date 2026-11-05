# Horarios-Peluquero

Sistema de gestión de horarios para peluquerías.

## Estructura del Proyecto

- `index.html` - Aplicación principal de gestión de horarios
- `personal.html` - Gestión de personal interno
- `calendario-tienda.html` - Vista de calendario por tienda
- `reportes.html` - Módulo de reportes
- `guias-envio.html` - Creación manual de guías con vista previa y descarga PDF

## Guías de envío

Desde **Navegación → Crear Guías de Envío**, completa la orden y los datos del
destinatario. La vista previa se actualiza mientras escribes. Los textos largos
reducen su tamaño y pueden ocupar dos líneas; si no caben con una letra legible,
el formulario indica qué campo acortar y evita descargar una guía incompleta.

El PDF ocupa la mitad derecha de una A4 horizontal (148,5 × 210 mm), con línea
de corte central. Imprime en tamaño real, al 100 %. El formulario funciona en
escritorio y móvil para los usuarios con acceso a Navegación; no guarda los datos
del destinatario ni necesita una API de Web Peluquero. Las imágenes y jsPDF 4.2.1
(licencia MIT en `js/vendor/jspdf.LICENSE.txt`) se sirven desde este proyecto.

## Ejecutar en local

```bash
npm run dev
```

Luego abre `http://localhost:3001/login.html`.
Si ese puerto está ocupado, el servidor usará el siguiente libre y lo mostrará en la terminal.

Para probar **Retiros** con los cambios de la API aún no desplegados, inicia también
Web Peluquero en otra terminal con `npm run dev` (puerto 3000). El servidor local
de Horarios reenvía únicamente `/api/horarios/pickups` a
`http://127.0.0.1:3000`, sin CORS. Si Web usa otro puerto, inicia Horarios con
`WEB_API_URL=http://127.0.0.1:PUERTO npm run dev`. Reinicia Horarios después de
cambiar esa variable.

## Auto-confirmación de retiros

En **Retiros**, cada pedido elegible muestra el tiempo hasta quedar **Listo para
Retiro**: 48 horas desde su creación, contando las noches de lunes a viernes y
pausando los sábados y domingos, con la hora de Ecuador. **Añadir más tiempo**
permite sumar entre 1 y 240 horas y registrar un motivo. El plazo se guarda en
Web Peluquero y se comparte entre usuarios; cambiar de dispositivo no lo reinicia.

La auto-confirmación y su aviso se realizan únicamente de lunes a viernes,
entre las 10:00 y las 17:30 de Ecuador. Si el plazo vence fuera de esa franja,
se programa a las 10:00 del siguiente día de lunes a viernes. El reloj muestra
la fecha ajustada. Las ampliaciones respetan la misma regla. El worker OpenWA
también conserva en cola los avisos automáticos que se retrasen fuera de horario;
se deben desplegar sus dos scripts actualizados junto con la API.

La transición automática se ejecuta en Web Peluquero mediante
`/api/cron/pickup-auto-ready`, programado cada minuto en su `vercel.json`.
Requiere desplegar ese backend junto con esta interfaz y disponer de
`CRON_SECRET` en Vercel. En desarrollo, Vercel no ejecuta el cron automáticamente.
La migración aditiva `prisma/migrations/pickup_auto_ready.sql` de Web incorpora
los campos del plazo; su aplicación no modifica estados ni envía notificaciones.
La confirmación automática conserva la verificación por código para la entrega.

## Archivos SQL (Supabase)

Scripts de configuración para la base de datos Supabase:
- `supabase_personal_setup.sql` - Configuración de tabla de personal
- `supabase_impulsadoras_pin.sql` - Sistema de PIN para impulsadoras
- `supabase_roles_setup.sql` - Configuración de roles
- `supabase_audit_setup.sql` - Sistema de auditoría
- `supabase_trigger_setup.sql` - Triggers de base de datos
- `supabase_keepalive_setup.sql` - Tabla `keepalive` para evitar pausa por inactividad
- `supabase_security_policies.sql` - Políticas RLS por rol y protección contra turnos duplicados
- `supabase_attendance_setup.sql` - Beta de asistencia aprobada por Punto de Venta
- `supabase_messages_setup.sql` - Buzón de mensajes, tareas, recurrencias y archivo por usuario

## Keepalive de Supabase

El proyecto incluye workflows de GitHub Actions:

- `.github/workflows/supabase-keepalive.yml`: inserta una fila diaria en la tabla `keepalive`.
- `.github/workflows/close-store-attendance.yml`: cierra asistencias pendientes a las 20:00 de Ecuador y genera faltas automáticas.

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
