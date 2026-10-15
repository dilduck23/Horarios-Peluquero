-- El marcaje de salida de jornada usa esta columna; la tabla de asistencia
-- existia en produccion antes de que se agregara al script de instalacion.
ALTER TABLE public."Tiendas_Asistencia"
ADD COLUMN IF NOT EXISTS salida_en TIMESTAMPTZ;

COMMENT ON COLUMN public."Tiendas_Asistencia".salida_en
IS 'Hora opcional en que el punto de venta marca salida de jornada de la impulsadora. No afecta el cierre automatico de faltas.';
