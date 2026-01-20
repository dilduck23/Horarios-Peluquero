-- ============================================
-- TRIGGER: Auto-registro de usuarios en Tiendas_Usuarios
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. FUNCIÓN QUE SE EJECUTA AL CREAR EL USUARIO
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public."Tiendas_Usuarios" (email, nombre, id_rol)
  VALUES (
    new.email, -- Email del usuario autenticado
    COALESCE(new.raw_user_meta_data->>'full_name', 'Nuevo Usuario'), -- Nombre (o default)
    4 -- ROL POR DEFECTO: 4 (Impulsadora / Solo ver calendario)
  )
  ON CONFLICT (email) DO NOTHING; -- Evitar duplicados si ya existe
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. CREAR EL TRIGGER EN LA TABLA auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================
-- NOTA:
-- Esto asegura que cualquier usuario nuevo que se registre
-- (o sea invitado) en Supabase Auth, aparezca automáticamente
-- en tu tabla de "Tiendas_Usuarios" con rol 4.
-- Luego tú puedes cambiarle el rol manualmente en la tabla.
-- ============================================
