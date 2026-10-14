# Sincronización diaria de ventas

Importa desde PCGN las facturas y notas de crédito activas, agrupa por vendedor y proveedor, y publica el resultado en Supabase. Las líneas cuya descripción contiene `[OBSEQUIO]` no se incluyen en ventas ni en cantidades de productos.

## Programación instalada

El usuario `jroman` de `openclaw-vm` ejecuta `horarios-sales-sync.timer` todos los días a las 20:00 en la zona `America/Guayaquil`. El timer es persistente: si el servidor estaba apagado, systemd ejecuta la tarea al volver a iniciar.

```bash
systemctl --user list-timers horarios-sales-sync.timer
journalctl --user -u horarios-sales-sync.service -n 50 --no-pager
systemctl --user start horarios-sales-sync.service
```

Para reprocesar una fecha manualmente:

```bash
cd /home/jroman/horarios-sales-sync
set -a
. /home/jroman/.config/horarios-sales-sync/env
set +a
node sync-sales.mjs 2026-10-14
```

La carga es idempotente: reprocesar una fecha reemplaza ese día en una sola transacción y no crea duplicados.

## Seguridad

El archivo `/home/jroman/.config/horarios-sales-sync/env` tiene permisos `600`. La clave `service_role` permanece únicamente en Ubuntu y nunca se entrega al navegador. Las tablas de ventas tienen RLS y solo los roles 1 y 2 pueden consultarlas desde el panel.
