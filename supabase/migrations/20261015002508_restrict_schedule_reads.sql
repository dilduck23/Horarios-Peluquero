-- Staff authenticated through Supabase can read only the schedules allowed by
-- their application role. PIN users receive their own schedule through the
-- self-attendance-status Edge Function instead of querying these tables.
DROP POLICY IF EXISTS "Lectura pública horarios" ON public."Tiendas_Horario";
DROP POLICY IF EXISTS "horario_select_public" ON public."Tiendas_Horario";
DROP POLICY IF EXISTS "horario_select_staff" ON public."Tiendas_Horario";
CREATE POLICY "horario_select_staff"
    ON public."Tiendas_Horario"
    FOR SELECT TO authenticated
    USING (
        private.staffplanner_role_id() IN (1, 2)
        OR (
            private.staffplanner_role_id() = 3
            AND tienda_id = private.staffplanner_tienda_id()
        )
    );

DROP POLICY IF EXISTS "personal_horario_select_public"
    ON public."Tiendas_Personal_Horario";
DROP POLICY IF EXISTS "personal_horario_select_staff"
    ON public."Tiendas_Personal_Horario";
CREATE POLICY "personal_horario_select_staff"
    ON public."Tiendas_Personal_Horario"
    FOR SELECT TO authenticated
    USING (
        private.staffplanner_role_id() IN (1, 2)
        OR (
            private.staffplanner_role_id() = 3
            AND tienda_id = private.staffplanner_tienda_id()
        )
    );

DROP POLICY IF EXISTS "Lectura pública impulsadoras"
    ON public."Tiendas_Impulsadoras";
DROP POLICY IF EXISTS "impulsadoras_select_public"
    ON public."Tiendas_Impulsadoras";
DROP POLICY IF EXISTS "impulsadoras_select_anon_safe"
    ON public."Tiendas_Impulsadoras";
DROP POLICY IF EXISTS "impulsadoras_select_staff"
    ON public."Tiendas_Impulsadoras";
CREATE POLICY "impulsadoras_select_staff"
    ON public."Tiendas_Impulsadoras"
    FOR SELECT TO authenticated
    USING (private.staffplanner_role_id() IN (1, 2, 3));

DROP POLICY IF EXISTS "personal_select_public" ON public."Tiendas_Personal";
DROP POLICY IF EXISTS "personal_select_anon_safe" ON public."Tiendas_Personal";
DROP POLICY IF EXISTS "personal_select_staff" ON public."Tiendas_Personal";
CREATE POLICY "personal_select_staff"
    ON public."Tiendas_Personal"
    FOR SELECT TO authenticated
    USING (private.staffplanner_role_id() IN (1, 2, 3));

DROP POLICY IF EXISTS "marcas_proveedores_select_public"
    ON public."Tiendas_Marcas_Proveedores";
DROP POLICY IF EXISTS "marcas_proveedores_select_staff"
    ON public."Tiendas_Marcas_Proveedores";
CREATE POLICY "marcas_proveedores_select_staff"
    ON public."Tiendas_Marcas_Proveedores"
    FOR SELECT TO authenticated
    USING (private.staffplanner_role_id() IN (1, 2, 3));

REVOKE SELECT ON public."Tiendas_Horario", public."Tiendas_Personal_Horario",
    public."Tiendas_Impulsadoras", public."Tiendas_Personal",
    public."Tiendas_Marcas_Proveedores"
    FROM PUBLIC, anon;
GRANT SELECT ON public."Tiendas_Horario", public."Tiendas_Personal_Horario",
    public."Tiendas_Impulsadoras", public."Tiendas_Personal",
    public."Tiendas_Marcas_Proveedores"
    TO authenticated;
