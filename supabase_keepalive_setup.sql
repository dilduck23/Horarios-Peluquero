-- ============================================
-- SUPABASE KEEPALIVE
-- Ejecutar en Supabase SQL Editor
-- ============================================
-- Esta tabla recibe un ping diario desde GitHub Actions para mantener
-- actividad en el proyecto Supabase y evitar pausas por inactividad.

CREATE TABLE IF NOT EXISTS public.keepalive (
    id SERIAL PRIMARY KEY,
    pinged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_keepalive_pinged_at
ON public.keepalive (pinged_at DESC);

ALTER TABLE public.keepalive ENABLE ROW LEVEL SECURITY;

-- No se crean policies publicas: el workflow usa SUPABASE_SERVICE_ROLE_KEY
-- guardada como GitHub Secret, y esa key omite RLS desde el servidor.
