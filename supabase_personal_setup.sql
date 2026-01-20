-- ============================================
-- PERSONAL INTERNO MODULE
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. TABLA: Tiendas_Personal (Personal interno del almacén)
CREATE TABLE IF NOT EXISTS "Tiendas_Personal" (
    id SERIAL PRIMARY KEY,
    
    -- Identificación
    idVendedor TEXT UNIQUE NOT NULL,  -- Código único del vendedor
    nombre_completo TEXT NOT NULL,
    
    -- Estado
    Habilitado BOOLEAN DEFAULT true,
    
    -- Ubicación fija
    idBodega INT REFERENCES "Tiendas_Razonamiento"(id),  -- Bodega asignada
    
    -- Acceso
    PIN TEXT,  -- 4 dígitos para login (único en esta tabla)
    
    -- Contacto (opcional)
    Whatsapp TEXT,
    Correo TEXT,
    
    -- Metadata
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice único para PIN (solo si no es null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_personal_pin_unique 
ON "Tiendas_Personal"(PIN) WHERE PIN IS NOT NULL;

-- Índice para búsqueda por bodega
CREATE INDEX IF NOT EXISTS idx_personal_bodega 
ON "Tiendas_Personal"(idBodega);


-- 2. TABLA: Tiendas_Personal_Horario (Calendario del personal interno)
CREATE TABLE IF NOT EXISTS "Tiendas_Personal_Horario" (
    id SERIAL PRIMARY KEY,
    
    -- Personal asignado
    personal_id INT NOT NULL REFERENCES "Tiendas_Personal"(id) ON DELETE CASCADE,
    
    -- Fecha
    fecha DATE NOT NULL,
    
    -- Tienda donde trabaja (puede ser diferente a su bodega fija)
    tienda_id INT REFERENCES "Tiendas_Razonamiento"(id),
    
    -- Tipo de registro
    tipo TEXT DEFAULT 'TRABAJO' CHECK (tipo IN ('TRABAJO', 'VACACIONES', 'PERMISO', 'LICENCIA')),
    
    -- Notas opcionales
    nota TEXT,
    
    -- Metadata
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Evitar duplicados: Un personal no puede tener 2 registros el mismo día
    UNIQUE(personal_id, fecha)
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_personal_horario_fecha 
ON "Tiendas_Personal_Horario"(fecha);

CREATE INDEX IF NOT EXISTS idx_personal_horario_personal 
ON "Tiendas_Personal_Horario"(personal_id);


-- 3. HABILITAR RLS
ALTER TABLE "Tiendas_Personal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tiendas_Personal_Horario" ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (ajustar según necesidad)
CREATE POLICY "Allow all for authenticated" ON "Tiendas_Personal"
    FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated" ON "Tiendas_Personal_Horario"
    FOR ALL USING (true);


-- ============================================
-- DATOS DE EJEMPLO (Opcional)
-- ============================================
-- INSERT INTO "Tiendas_Personal" (idVendedor, nombre_completo, idBodega, PIN)
-- VALUES 
--     ('V001', 'Carlos Pérez', 1, '1234'),
--     ('V002', 'María López', 1, '5678'),
--     ('V003', 'Juan García', 2, '9012');
