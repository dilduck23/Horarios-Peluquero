-- Read-only access for users who supervise the complete operation without
-- permission to create, edit, approve, report, or delete records.
INSERT INTO public."Tiendas_Roles" (id, nombre, descripcion)
VALUES (5, 'Lector de Horarios', 'Consulta horarios, ventas, reportes, tiendas y personal interno sin modificar datos')
ON CONFLICT (id) DO UPDATE
SET nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion;

SELECT setval(
    pg_get_serial_sequence('public."Tiendas_Roles"', 'id'),
    (SELECT max(id) FROM public."Tiendas_Roles"),
    true
);

INSERT INTO public."Tiendas_Usuarios" (email, nombre, id_rol, activo)
VALUES ('mroman@novepsa.com', 'M. Román', 5, true)
ON CONFLICT (email) DO UPDATE
SET id_rol = EXCLUDED.id_rol,
    activo = true;

DROP POLICY IF EXISTS "horario_select_staff" ON public."Tiendas_Horario";
CREATE POLICY "horario_select_staff"
    ON public."Tiendas_Horario"
    FOR SELECT TO authenticated
    USING (
        private.staffplanner_role_id() IN (1, 2, 5)
        OR (
            private.staffplanner_role_id() = 3
            AND tienda_id = private.staffplanner_tienda_id()
        )
    );

DROP POLICY IF EXISTS "personal_horario_select_staff" ON public."Tiendas_Personal_Horario";
CREATE POLICY "personal_horario_select_staff"
    ON public."Tiendas_Personal_Horario"
    FOR SELECT TO authenticated
    USING (
        private.staffplanner_role_id() IN (1, 2, 5)
        OR (
            private.staffplanner_role_id() = 3
            AND tienda_id = private.staffplanner_tienda_id()
        )
    );

DROP POLICY IF EXISTS "impulsadoras_select_staff" ON public."Tiendas_Impulsadoras";
CREATE POLICY "impulsadoras_select_staff"
    ON public."Tiendas_Impulsadoras"
    FOR SELECT TO authenticated
    USING (private.staffplanner_role_id() IN (1, 2, 3, 5));

DROP POLICY IF EXISTS "personal_select_staff" ON public."Tiendas_Personal";
CREATE POLICY "personal_select_staff"
    ON public."Tiendas_Personal"
    FOR SELECT TO authenticated
    USING (private.staffplanner_role_id() IN (1, 2, 3, 5));

DROP POLICY IF EXISTS "marcas_proveedores_select_staff" ON public."Tiendas_Marcas_Proveedores";
CREATE POLICY "marcas_proveedores_select_staff"
    ON public."Tiendas_Marcas_Proveedores"
    FOR SELECT TO authenticated
    USING (private.staffplanner_role_id() IN (1, 2, 3, 5));

DROP POLICY IF EXISTS "impulsadora_proveedores_select_staff" ON public."Tiendas_Impulsadoras_Proveedores";
CREATE POLICY "impulsadora_proveedores_select_staff"
    ON public."Tiendas_Impulsadoras_Proveedores"
    FOR SELECT TO authenticated
    USING (private.staffplanner_role_id() IN (1, 2, 3, 5));

DROP POLICY IF EXISTS "asistencia_select_authorized" ON public."Tiendas_Asistencia";
CREATE POLICY "asistencia_select_authorized"
    ON public."Tiendas_Asistencia"
    FOR SELECT TO authenticated
    USING (
        private.staffplanner_role_id() IN (1, 2, 5)
        OR (
            private.staffplanner_role_id() = 3
            AND tienda_id = private.staffplanner_tienda_id()
        )
    );

DROP POLICY IF EXISTS "faltas_select_public" ON public."Tiendas_Faltas";
DROP POLICY IF EXISTS "faltas_select_staff" ON public."Tiendas_Faltas";
CREATE POLICY "faltas_select_staff"
    ON public."Tiendas_Faltas"
    FOR SELECT TO authenticated
    USING (
        private.staffplanner_role_id() IN (1, 2, 5)
        OR (
            private.staffplanner_role_id() = 3
            AND EXISTS (
                SELECT 1
                FROM public."Tiendas_Horario" h
                WHERE h.id = id_horario
                  AND h.tienda_id = private.staffplanner_tienda_id()
            )
        )
    );

DROP POLICY IF EXISTS "ventas_diarias_select_managers" ON public."Tiendas_Ventas_Diarias";
CREATE POLICY "ventas_diarias_select_managers"
    ON public."Tiendas_Ventas_Diarias"
    FOR SELECT TO authenticated
    USING (private.staffplanner_role_id() IN (1, 2, 5));

DROP POLICY IF EXISTS "ventas_productos_select_managers" ON public."Tiendas_Ventas_Diarias_Productos";
CREATE POLICY "ventas_productos_select_managers"
    ON public."Tiendas_Ventas_Diarias_Productos"
    FOR SELECT TO authenticated
    USING (private.staffplanner_role_id() IN (1, 2, 5));

DROP POLICY IF EXISTS "ventas_sync_select_managers" ON public."Tiendas_Ventas_Sincronizaciones";
CREATE POLICY "ventas_sync_select_managers"
    ON public."Tiendas_Ventas_Sincronizaciones"
    FOR SELECT TO authenticated
    USING (private.staffplanner_role_id() IN (1, 2, 5));

-- Intentionally no INSERT, UPDATE, DELETE, or ALL policy is granted to role 5.
