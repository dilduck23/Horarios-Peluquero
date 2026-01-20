-- ============================================
-- TABLA DE AUDITORÍA: Tiendas_Registros
-- Historial de cambios realizados en el sistema
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. CREAR TABLA DE REGISTROS/AUDITORÍA
CREATE TABLE IF NOT EXISTS "Tiendas_Registros" (
    id SERIAL PRIMARY KEY,
    
    -- Quién hizo el cambio (referencia a Tiendas_Usuarios)
    id_usuario INT REFERENCES "Tiendas_Usuarios"(id),
    email_usuario TEXT,  -- Backup del email por si se borra el usuario
    
    -- Qué acción se realizó
    accion TEXT NOT NULL CHECK (accion IN ('CREAR', 'EDITAR', 'ELIMINAR', 'ASIGNAR', 'REPORTE')),
    
    -- En qué tabla/entidad
    entidad TEXT NOT NULL,  -- Ej: 'Tiendas_Horario', 'Tiendas_Impulsadoras', 'Tiendas_Razonamiento'
    
    -- ID del registro afectado
    id_registro INT,
    
    -- Descripción legible del cambio
    descripcion TEXT NOT NULL,
    
    -- Datos adicionales en JSON (valores anteriores/nuevos)
    datos_json JSONB,
    
    -- Timestamp
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CREAR ÍNDICES PARA BÚSQUEDAS RÁPIDAS
CREATE INDEX IF NOT EXISTS idx_registros_usuario ON "Tiendas_Registros"(id_usuario);
CREATE INDEX IF NOT EXISTS idx_registros_entidad ON "Tiendas_Registros"(entidad);
CREATE INDEX IF NOT EXISTS idx_registros_fecha ON "Tiendas_Registros"(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_registros_accion ON "Tiendas_Registros"(accion);

-- 3. HABILITAR RLS (Row Level Security)
ALTER TABLE "Tiendas_Registros" ENABLE ROW LEVEL SECURITY;

-- Política: Solo admins pueden ver el historial completo
CREATE POLICY "Admins can view all logs" ON "Tiendas_Registros"
    FOR SELECT
    USING (true);  -- Ajustar según necesidades

-- Política: Cualquier usuario autenticado puede insertar logs
CREATE POLICY "Authenticated users can insert logs" ON "Tiendas_Registros"
    FOR INSERT
    WITH CHECK (true);

-- ============================================
-- EJEMPLOS DE USO EN JAVASCRIPT:
-- 
-- Al crear una asignación:
-- await db.from('Tiendas_Registros').insert({
--     id_usuario: parseInt(sessionStorage.getItem('staffPlannerUserId')),
--     email_usuario: JSON.parse(sessionStorage.getItem('staffPlannerUser')).email,
--     accion: 'ASIGNAR',
--     entidad: 'Tiendas_Horario',
--     id_registro: newAssignmentId,
--     descripcion: 'Asignó a María García en Tienda Centro el 18/01/2026',
--     datos_json: { tienda_id: 5, impulsadora_id: 12, fecha: '2026-01-18' }
-- });
--
-- Al editar una tienda:
-- await db.from('Tiendas_Registros').insert({
--     id_usuario: userId,
--     email_usuario: userEmail,
--     accion: 'EDITAR',
--     entidad: 'Tiendas_Razonamiento',
--     id_registro: storeId,
--     descripcion: 'Editó cupo de Tienda Norte (Zona A: 2→3)',
--     datos_json: { campo: 'cupo_zona_a', anterior: 2, nuevo: 3 }
-- });
-- ============================================
