-- ============================================
-- PERSONAL INTERNO: DIA LIBRE
-- Ejecutar en Supabase SQL Editor si la tabla ya existe
-- ============================================

ALTER TABLE "Tiendas_Personal_Horario"
DROP CONSTRAINT IF EXISTS "Tiendas_Personal_Horario_tipo_check";

ALTER TABLE "Tiendas_Personal_Horario"
ADD CONSTRAINT "Tiendas_Personal_Horario_tipo_check"
CHECK (tipo IN ('TRABAJO', 'VACACIONES', 'PERMISO', 'LICENCIA', 'DIA LIBRE'));
