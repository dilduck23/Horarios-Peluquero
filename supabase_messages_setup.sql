-- ============================================
-- BUZON DE MENSAJES Y TAREAS - StaffPlanner
-- Ejecutar despues de supabase_security_policies.sql
-- ============================================

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM public;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.staffplanner_user_id()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT u.id
    FROM public."Tiendas_Usuarios" u
    WHERE lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      AND u.activo IS TRUE
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private.staffplanner_user_id() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.staffplanner_user_id() TO authenticated;

CREATE TABLE IF NOT EXISTS public."Tiendas_Mensajes" (
    id SERIAL PRIMARY KEY,
    titulo TEXT NOT NULL,
    resumen TEXT,
    detalle TEXT,
    tipo TEXT NOT NULL DEFAULT 'aviso' CHECK (tipo IN ('aviso', 'tarea')),
    accion_requerida TEXT NOT NULL DEFAULT 'visto' CHECK (accion_requerida IN ('visto', 'completado')),
    publicar_en DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Guayaquil')::date),
    vence_en DATE,
    recurrencia TEXT NOT NULL DEFAULT 'ninguna' CHECK (recurrencia IN ('ninguna', 'mensual')),
    dia_publicacion_mensual INTEGER CHECK (dia_publicacion_mensual BETWEEN 1 AND 28),
    dia_vencimiento_mensual INTEGER CHECK (dia_vencimiento_mensual BETWEEN 1 AND 31),
    activo BOOLEAN NOT NULL DEFAULT true,
    creado_por INTEGER REFERENCES public."Tiendas_Usuarios"(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public."Tiendas_Mensajes_Destinos" (
    id SERIAL PRIMARY KEY,
    mensaje_id INTEGER NOT NULL REFERENCES public."Tiendas_Mensajes"(id) ON DELETE CASCADE,
    alcance TEXT NOT NULL DEFAULT 'todos' CHECK (alcance IN ('todos', 'tienda')),
    tienda_id INTEGER REFERENCES public."Tiendas_Razonamiento"(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        (alcance = 'todos' AND tienda_id IS NULL)
        OR (alcance = 'tienda' AND tienda_id IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS public."Tiendas_Mensajes_Estados" (
    id SERIAL PRIMARY KEY,
    mensaje_id INTEGER NOT NULL REFERENCES public."Tiendas_Mensajes"(id) ON DELETE CASCADE,
    usuario_id INTEGER NOT NULL REFERENCES public."Tiendas_Usuarios"(id) ON DELETE CASCADE,
    occurrence_key TEXT NOT NULL DEFAULT 'single',
    visto_en TIMESTAMPTZ,
    completado_en TIMESTAMPTZ,
    archivado_en TIMESTAMPTZ,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (mensaje_id, usuario_id, occurrence_key)
);

CREATE INDEX IF NOT EXISTS idx_mensajes_activo_publicar
ON public."Tiendas_Mensajes" (activo, publicar_en);

CREATE INDEX IF NOT EXISTS idx_mensajes_recurrencia
ON public."Tiendas_Mensajes" (recurrencia, dia_publicacion_mensual);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mensajes_destino_todos
ON public."Tiendas_Mensajes_Destinos" (mensaje_id)
WHERE alcance = 'todos';

CREATE UNIQUE INDEX IF NOT EXISTS uq_mensajes_destino_tienda
ON public."Tiendas_Mensajes_Destinos" (mensaje_id, tienda_id)
WHERE alcance = 'tienda';

CREATE INDEX IF NOT EXISTS idx_mensajes_destinos_tienda
ON public."Tiendas_Mensajes_Destinos" (tienda_id, mensaje_id);

CREATE INDEX IF NOT EXISTS idx_mensajes_estados_usuario
ON public."Tiendas_Mensajes_Estados" (usuario_id, archivado_en, mensaje_id);

ALTER TABLE public."Tiendas_Mensajes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Tiendas_Mensajes_Destinos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Tiendas_Mensajes_Estados" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mensajes_select_authorized" ON public."Tiendas_Mensajes";
DROP POLICY IF EXISTS "mensajes_insert_managers" ON public."Tiendas_Mensajes";
DROP POLICY IF EXISTS "mensajes_update_managers" ON public."Tiendas_Mensajes";
DROP POLICY IF EXISTS "mensajes_delete_managers" ON public."Tiendas_Mensajes";
DROP POLICY IF EXISTS "mensajes_destinos_select_authorized" ON public."Tiendas_Mensajes_Destinos";
DROP POLICY IF EXISTS "mensajes_destinos_write_managers" ON public."Tiendas_Mensajes_Destinos";
DROP POLICY IF EXISTS "mensajes_estados_select_authorized" ON public."Tiendas_Mensajes_Estados";
DROP POLICY IF EXISTS "mensajes_estados_insert_own" ON public."Tiendas_Mensajes_Estados";
DROP POLICY IF EXISTS "mensajes_estados_update_own" ON public."Tiendas_Mensajes_Estados";
DROP POLICY IF EXISTS "mensajes_estados_delete_managers" ON public."Tiendas_Mensajes_Estados";

CREATE POLICY "mensajes_select_authorized" ON public."Tiendas_Mensajes"
FOR SELECT TO authenticated
USING (
    (select private.staffplanner_role_id()) IN (1, 2)
    OR (
        (select private.staffplanner_role_id()) = 3
        AND activo IS TRUE
        AND publicar_en <= ((now() AT TIME ZONE 'America/Guayaquil')::date)
        AND EXISTS (
            SELECT 1
            FROM public."Tiendas_Mensajes_Destinos" d
            WHERE d.mensaje_id = id
              AND (
                  d.alcance = 'todos'
                  OR d.tienda_id = (select private.staffplanner_tienda_id())
              )
        )
    )
);

CREATE POLICY "mensajes_insert_managers" ON public."Tiendas_Mensajes"
FOR INSERT TO authenticated
WITH CHECK ((select private.staffplanner_role_id()) IN (1, 2));

CREATE POLICY "mensajes_update_managers" ON public."Tiendas_Mensajes"
FOR UPDATE TO authenticated
USING ((select private.staffplanner_role_id()) IN (1, 2))
WITH CHECK ((select private.staffplanner_role_id()) IN (1, 2));

CREATE POLICY "mensajes_delete_managers" ON public."Tiendas_Mensajes"
FOR DELETE TO authenticated
USING ((select private.staffplanner_role_id()) IN (1, 2));

CREATE POLICY "mensajes_destinos_select_authorized" ON public."Tiendas_Mensajes_Destinos"
FOR SELECT TO authenticated
USING (
    (select private.staffplanner_role_id()) IN (1, 2)
    OR (
        (select private.staffplanner_role_id()) = 3
        AND (
            alcance = 'todos'
            OR tienda_id = (select private.staffplanner_tienda_id())
        )
    )
);

CREATE POLICY "mensajes_destinos_write_managers" ON public."Tiendas_Mensajes_Destinos"
FOR ALL TO authenticated
USING ((select private.staffplanner_role_id()) IN (1, 2))
WITH CHECK ((select private.staffplanner_role_id()) IN (1, 2));

CREATE POLICY "mensajes_estados_select_authorized" ON public."Tiendas_Mensajes_Estados"
FOR SELECT TO authenticated
USING (
    (select private.staffplanner_role_id()) IN (1, 2)
    OR usuario_id = (select private.staffplanner_user_id())
);

CREATE POLICY "mensajes_estados_insert_own" ON public."Tiendas_Mensajes_Estados"
FOR INSERT TO authenticated
WITH CHECK (
    (select private.staffplanner_role_id()) = 3
    AND usuario_id = (select private.staffplanner_user_id())
    AND EXISTS (
        SELECT 1
        FROM public."Tiendas_Mensajes" m
        WHERE m.id = mensaje_id
    )
);

CREATE POLICY "mensajes_estados_update_own" ON public."Tiendas_Mensajes_Estados"
FOR UPDATE TO authenticated
USING (
    (select private.staffplanner_role_id()) = 3
    AND usuario_id = (select private.staffplanner_user_id())
)
WITH CHECK (
    (select private.staffplanner_role_id()) = 3
    AND usuario_id = (select private.staffplanner_user_id())
);

CREATE POLICY "mensajes_estados_delete_managers" ON public."Tiendas_Mensajes_Estados"
FOR DELETE TO authenticated
USING ((select private.staffplanner_role_id()) IN (1, 2));

GRANT SELECT, INSERT, UPDATE, DELETE ON public."Tiendas_Mensajes" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."Tiendas_Mensajes_Destinos" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."Tiendas_Mensajes_Estados" TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."Tiendas_Mensajes" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."Tiendas_Mensajes_Destinos" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."Tiendas_Mensajes_Estados" TO service_role;

GRANT USAGE, SELECT ON SEQUENCE public."Tiendas_Mensajes_id_seq" TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public."Tiendas_Mensajes_Destinos_id_seq" TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public."Tiendas_Mensajes_Estados_id_seq" TO authenticated, service_role;

COMMENT ON TABLE public."Tiendas_Mensajes" IS 'Mensajes, avisos y tareas planificadas para administradores de tienda.';
COMMENT ON TABLE public."Tiendas_Mensajes_Estados" IS 'Estado individual por usuario y ocurrencia de mensaje.';

-- Ejemplo de tarea mensual:
-- INSERT INTO public."Tiendas_Mensajes"
-- (titulo, resumen, detalle, tipo, accion_requerida, recurrencia, dia_publicacion_mensual, dia_vencimiento_mensual, activo)
-- VALUES ('Enviar Lista de Ingresos/Egresos', 'Enviar el reporte mensual antes del dia 5.', 'Subir o enviar la lista completa de ingresos y egresos del local.', 'tarea', 'completado', 'mensual', 1, 5, true);
-- INSERT INTO public."Tiendas_Mensajes_Destinos" (mensaje_id, alcance)
-- VALUES (currval('public."Tiendas_Mensajes_id_seq"'), 'todos');
