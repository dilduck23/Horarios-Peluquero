-- =====================================================
-- BETA: ASISTENCIA APROBADA POR PUNTO DE VENTA
-- Ejecutar en Supabase SQL Editor despues de los scripts base.
-- =====================================================

CREATE TABLE IF NOT EXISTS public."Tiendas_Asistencia" (
    id BIGSERIAL PRIMARY KEY,
    horario_id INTEGER NOT NULL REFERENCES public."Tiendas_Horario"(id) ON DELETE CASCADE,
    impulsadora_id INTEGER NOT NULL REFERENCES public."Tiendas_Impulsadoras"(id),
    tienda_id INTEGER NOT NULL REFERENCES public."Tiendas_Razonamiento"(id),
    fecha DATE NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'aprobada', 'falta_generada')),
    aprobado_por INTEGER REFERENCES public."Tiendas_Usuarios"(id),
    aprobado_en TIMESTAMPTZ,
    almuerzo_salida_en TIMESTAMPTZ,
    almuerzo_ingreso_en TIMESTAMPTZ,
    almuerzo_minutos INTEGER CHECK (almuerzo_minutos IS NULL OR almuerzo_minutos >= 0),
    salida_en TIMESTAMPTZ,
    correo_falta_auto_enviado_en TIMESTAMPTZ,
    cerrado_en TIMESTAMPTZ,
    falta_id INTEGER REFERENCES public."Tiendas_Faltas"(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (horario_id)
);

ALTER TABLE public."Tiendas_Asistencia"
ADD COLUMN IF NOT EXISTS correo_falta_auto_enviado_en TIMESTAMPTZ;

ALTER TABLE public."Tiendas_Asistencia"
ADD COLUMN IF NOT EXISTS salida_en TIMESTAMPTZ;

COMMENT ON COLUMN public."Tiendas_Asistencia".correo_falta_auto_enviado_en
IS 'Marca idempotente de envio de correo cuando se genera una FALTA NO APROBADA automatica.';

COMMENT ON COLUMN public."Tiendas_Asistencia".salida_en
IS 'Hora opcional en que el punto de venta marca salida de jornada de la impulsadora. No afecta el cierre automatico de faltas.';

CREATE INDEX IF NOT EXISTS idx_asistencia_fecha_tienda
ON public."Tiendas_Asistencia" (fecha, tienda_id);

CREATE INDEX IF NOT EXISTS idx_asistencia_estado_fecha
ON public."Tiendas_Asistencia" (estado, fecha);

CREATE INDEX IF NOT EXISTS idx_asistencia_falta
ON public."Tiendas_Asistencia" (falta_id)
WHERE falta_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_faltas_auto_no_aprobada
ON public."Tiendas_Faltas" (id_horario, asunto)
WHERE asunto = 'FALTA NO APROBADA';

ALTER TABLE public."Tiendas_Asistencia" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asistencia_select_authorized" ON public."Tiendas_Asistencia";
CREATE POLICY "asistencia_select_authorized"
ON public."Tiendas_Asistencia"
FOR SELECT TO authenticated
USING (
    private.staffplanner_role_id() IN (1, 2)
    OR (
        private.staffplanner_role_id() = 3
        AND tienda_id = private.staffplanner_tienda_id()
    )
);

-- La escritura se hace desde Edge Functions con service role para mantener
-- la regla de negocio centralizada: cada punto solo aprueba su propio local.
REVOKE INSERT, UPDATE, DELETE ON public."Tiendas_Asistencia" FROM anon, authenticated;
GRANT SELECT ON public."Tiendas_Asistencia" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."Tiendas_Asistencia" TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public."Tiendas_Asistencia_id_seq" TO service_role;

-- Asegura que service_role pueda generar y remover faltas desde funciones.
GRANT SELECT, INSERT, UPDATE, DELETE ON public."Tiendas_Faltas" TO service_role;
