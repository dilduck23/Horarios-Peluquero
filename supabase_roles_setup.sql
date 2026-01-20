-- ============================================
-- SISTEMA DE ROLES - StaffPlanner
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. TABLA DE ROLES (Catálogo)
CREATE TABLE IF NOT EXISTS "Tiendas_Roles" (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    descripcion TEXT
);

-- 2. INSERTAR ROLES INICIALES
INSERT INTO "Tiendas_Roles" (id, nombre, descripcion) VALUES
    (1, 'Administrador', 'Acceso total al sistema'),
    (2, 'Organizador', 'Gestiona personal y horarios'),
    (3, 'Punto de Venta', 'Visualiza calendario y reporta faltas'),
    (4, 'Impulsadora', 'Solo ve su horario personal')
ON CONFLICT (id) DO NOTHING;

-- 3. TABLA DE USUARIOS
CREATE TABLE IF NOT EXISTS "Tiendas_Usuarios" (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    id_rol INTEGER NOT NULL REFERENCES "Tiendas_Roles"(id),
    id_tienda INTEGER REFERENCES "Tiendas_Razonamiento"(id),  -- Para Punto de Venta
    id_impulsadora INTEGER REFERENCES "Tiendas_Impulsadoras"(id),  -- Vincular con impulsadora
    activo BOOLEAN DEFAULT true,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON "Tiendas_Usuarios"(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON "Tiendas_Usuarios"(id_rol);

-- 5. HABILITAR RLS (Row Level Security)
ALTER TABLE "Tiendas_Roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tiendas_Usuarios" ENABLE ROW LEVEL SECURITY;

-- 6. POLÍTICAS DE LECTURA (todos pueden leer roles)
CREATE POLICY "Roles are viewable by everyone" 
    ON "Tiendas_Roles" FOR SELECT 
    USING (true);

-- 7. POLÍTICA PARA USUARIOS (lectura autenticada)
CREATE POLICY "Users can view their own data" 
    ON "Tiendas_Usuarios" FOR SELECT 
    USING (auth.uid() IS NOT NULL);

-- ============================================
-- USUARIO ADMIN INICIAL (MODIFICA EL EMAIL)
-- ============================================
-- INSERT INTO "Tiendas_Usuarios" (email, nombre, id_rol) VALUES
--     ('croman@novepsa.com', 'Carlos Román', 1);
