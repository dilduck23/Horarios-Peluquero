-- ============================================
-- POLITICAS RLS Y DUPLICADOS - StaffPlanner
-- Ejecutar despues de los scripts base.
-- ============================================

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.staffplanner_role_id()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT u.id_rol
    FROM public."Tiendas_Usuarios" u
    WHERE lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      AND u.activo IS TRUE
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.staffplanner_tienda_id()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT u.id_tienda
    FROM public."Tiendas_Usuarios" u
    WHERE lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      AND u.activo IS TRUE
    LIMIT 1;
$$;

REVOKE ALL ON SCHEMA private FROM public;
GRANT USAGE ON SCHEMA private TO authenticated;
REVOKE ALL ON FUNCTION private.staffplanner_role_id() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION private.staffplanner_tienda_id() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.staffplanner_role_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.staffplanner_tienda_id() TO authenticated;

CREATE UNIQUE INDEX IF NOT EXISTS uq_horario_fecha_tienda_impulsadora
ON public."Tiendas_Horario" (fecha, tienda_id, impulsadora_id);

COMMENT ON INDEX public.uq_horario_fecha_tienda_impulsadora
IS 'Evita duplicar el mismo turno para la misma impulsadora, tienda y fecha.';

ALTER TABLE public."Tiendas_Categorias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Tiendas_Faltas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Tiendas_Horario" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Tiendas_Impulsadoras" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Tiendas_Personal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Tiendas_Personal_Horario" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Tiendas_Razonamiento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Tiendas_Registros" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Tiendas_Roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Tiendas_Usuarios" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Escritura pública categorias" ON public."Tiendas_Categorias";
DROP POLICY IF EXISTS "Lectura pública categorias" ON public."Tiendas_Categorias";
DROP POLICY IF EXISTS "Escritura pública faltas" ON public."Tiendas_Faltas";
DROP POLICY IF EXISTS "Lectura pública faltas" ON public."Tiendas_Faltas";
DROP POLICY IF EXISTS "Escritura pública horarios" ON public."Tiendas_Horario";
DROP POLICY IF EXISTS "Lectura pública horarios" ON public."Tiendas_Horario";
DROP POLICY IF EXISTS "Escritura pública impulsadoras" ON public."Tiendas_Impulsadoras";
DROP POLICY IF EXISTS "Lectura pública impulsadoras" ON public."Tiendas_Impulsadoras";
DROP POLICY IF EXISTS "Allow all for authenticated" ON public."Tiendas_Personal";
DROP POLICY IF EXISTS "Allow all for authenticated" ON public."Tiendas_Personal_Horario";
DROP POLICY IF EXISTS "personal_horario_insert_store_admins" ON public."Tiendas_Personal_Horario";
DROP POLICY IF EXISTS "personal_horario_update_store_admins" ON public."Tiendas_Personal_Horario";
DROP POLICY IF EXISTS "personal_horario_delete_store_admins" ON public."Tiendas_Personal_Horario";
DROP POLICY IF EXISTS "Escritura pública tiendas" ON public."Tiendas_Razonamiento";
DROP POLICY IF EXISTS "Lectura pública tiendas" ON public."Tiendas_Razonamiento";
DROP POLICY IF EXISTS "Admins can view all logs" ON public."Tiendas_Registros";
DROP POLICY IF EXISTS "Authenticated users can insert logs" ON public."Tiendas_Registros";
DROP POLICY IF EXISTS "Roles are viewable by everyone" ON public."Tiendas_Roles";
DROP POLICY IF EXISTS "Users can view their own data" ON public."Tiendas_Usuarios";

CREATE POLICY "categorias_select_public" ON public."Tiendas_Categorias" FOR SELECT TO public USING (true);
CREATE POLICY "tiendas_select_public" ON public."Tiendas_Razonamiento" FOR SELECT TO public USING (true);
CREATE POLICY "impulsadoras_select_public" ON public."Tiendas_Impulsadoras" FOR SELECT TO public USING (true);
CREATE POLICY "horario_select_public" ON public."Tiendas_Horario" FOR SELECT TO public USING (true);
CREATE POLICY "faltas_select_public" ON public."Tiendas_Faltas" FOR SELECT TO public USING (true);
CREATE POLICY "personal_select_public" ON public."Tiendas_Personal" FOR SELECT TO public USING (true);
CREATE POLICY "personal_horario_select_public" ON public."Tiendas_Personal_Horario" FOR SELECT TO public USING (true);

CREATE POLICY "categorias_write_admin" ON public."Tiendas_Categorias"
FOR ALL TO authenticated USING (private.staffplanner_role_id() = 1)
WITH CHECK (private.staffplanner_role_id() = 1);

CREATE POLICY "tiendas_write_admin" ON public."Tiendas_Razonamiento"
FOR ALL TO authenticated USING (private.staffplanner_role_id() = 1)
WITH CHECK (private.staffplanner_role_id() = 1);

CREATE POLICY "impulsadoras_write_managers" ON public."Tiendas_Impulsadoras"
FOR ALL TO authenticated USING (private.staffplanner_role_id() IN (1, 2))
WITH CHECK (private.staffplanner_role_id() IN (1, 2));

CREATE POLICY "horario_insert_managers" ON public."Tiendas_Horario"
FOR INSERT TO authenticated WITH CHECK (private.staffplanner_role_id() IN (1, 2));

CREATE POLICY "horario_update_managers" ON public."Tiendas_Horario"
FOR UPDATE TO authenticated USING (private.staffplanner_role_id() IN (1, 2))
WITH CHECK (private.staffplanner_role_id() IN (1, 2));

CREATE POLICY "horario_delete_managers" ON public."Tiendas_Horario"
FOR DELETE TO authenticated USING (private.staffplanner_role_id() IN (1, 2));

CREATE POLICY "faltas_insert_authorized" ON public."Tiendas_Faltas"
FOR INSERT TO authenticated
WITH CHECK (
    private.staffplanner_role_id() IN (1, 2)
    OR (
        private.staffplanner_role_id() = 3
        AND EXISTS (
            SELECT 1
            FROM public."Tiendas_Horario" h
            WHERE h.id = id_horario
              AND h.tienda_id = private.staffplanner_tienda_id()
              AND h.fecha <= ((now() AT TIME ZONE 'America/Guayaquil')::date)
        )
    )
);

CREATE POLICY "faltas_delete_managers" ON public."Tiendas_Faltas"
FOR DELETE TO authenticated USING (private.staffplanner_role_id() IN (1, 2));

CREATE POLICY "personal_write_managers" ON public."Tiendas_Personal"
FOR ALL TO authenticated USING (private.staffplanner_role_id() IN (1, 2))
WITH CHECK (private.staffplanner_role_id() IN (1, 2));

CREATE POLICY "personal_horario_write_managers" ON public."Tiendas_Personal_Horario"
FOR ALL TO authenticated USING (private.staffplanner_role_id() IN (1, 2))
WITH CHECK (private.staffplanner_role_id() IN (1, 2));

CREATE POLICY "personal_horario_insert_store_admins" ON public."Tiendas_Personal_Horario"
FOR INSERT TO authenticated
WITH CHECK (
    private.staffplanner_role_id() = 3
    AND tienda_id = private.staffplanner_tienda_id()
);

CREATE POLICY "personal_horario_update_store_admins" ON public."Tiendas_Personal_Horario"
FOR UPDATE TO authenticated
USING (
    private.staffplanner_role_id() = 3
    AND tienda_id = private.staffplanner_tienda_id()
)
WITH CHECK (
    private.staffplanner_role_id() = 3
    AND tienda_id = private.staffplanner_tienda_id()
);

CREATE POLICY "personal_horario_delete_store_admins" ON public."Tiendas_Personal_Horario"
FOR DELETE TO authenticated
USING (
    private.staffplanner_role_id() = 3
    AND tienda_id = private.staffplanner_tienda_id()
);

CREATE POLICY "roles_select_authenticated" ON public."Tiendas_Roles"
FOR SELECT TO authenticated USING (true);

CREATE POLICY "usuarios_select_own_or_admin" ON public."Tiendas_Usuarios"
FOR SELECT TO authenticated
USING (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    OR private.staffplanner_role_id() = 1
);

CREATE POLICY "registros_select_managers" ON public."Tiendas_Registros"
FOR SELECT TO authenticated USING (private.staffplanner_role_id() IN (1, 2));

CREATE POLICY "registros_insert_authenticated" ON public."Tiendas_Registros"
FOR INSERT TO authenticated WITH CHECK (private.staffplanner_role_id() IN (1, 2, 3));
