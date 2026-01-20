-- =====================================================
-- AÑADIR PIN A TIENDAS_IMPULSADORAS
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- 1. Agregar columna PIN a la tabla existente
ALTER TABLE Tiendas_Impulsadoras 
ADD COLUMN IF NOT EXISTS PIN text;

-- 2. Crear índice único para el PIN (evitar duplicados)
CREATE UNIQUE INDEX IF NOT EXISTS idx_impulsadoras_pin_unique 
ON Tiendas_Impulsadoras (PIN) 
WHERE PIN IS NOT NULL;

-- 3. (Opcional) Si quieres generar PINs aleatorios para registros existentes:
-- UPDATE Tiendas_Impulsadoras 
-- SET PIN = LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0')
-- WHERE PIN IS NULL;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Ejecuta esta consulta para ver la estructura actualizada:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'tiendas_impulsadoras';
