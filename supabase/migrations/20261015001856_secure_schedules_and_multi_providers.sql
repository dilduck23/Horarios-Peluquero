-- Protect employee schedules from anonymous Data API reads and support
-- more than one provider per promoter without duplicating the person.

CREATE TABLE IF NOT EXISTS public."Tiendas_Pin_Login_Attempts" (
    key_hash text PRIMARY KEY,
    window_started_at timestamptz NOT NULL DEFAULT now(),
    attempts integer NOT NULL DEFAULT 0
);
ALTER TABLE public."Tiendas_Pin_Login_Attempts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."Tiendas_Pin_Login_Attempts" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."Tiendas_Pin_Login_Attempts" TO service_role;

CREATE OR REPLACE FUNCTION public.staffplanner_pin_login_attempt(
    p_key_hash text,
    p_max_attempts integer DEFAULT 5
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
    allowed boolean;
BEGIN
    IF p_key_hash IS NULL OR p_key_hash !~ '^[0-9a-f]{64}$'
       OR p_max_attempts < 1 OR p_max_attempts > 100 THEN
        RETURN false;
    END IF;
    INSERT INTO public."Tiendas_Pin_Login_Attempts" AS attempts (
        key_hash, window_started_at, attempts
    )
    VALUES (p_key_hash, now(), 1)
    ON CONFLICT (key_hash) DO UPDATE
    SET window_started_at = CASE
            WHEN attempts.window_started_at < now() - interval '15 minutes' THEN now()
            ELSE attempts.window_started_at
        END,
        attempts = CASE
            WHEN attempts.window_started_at < now() - interval '15 minutes' THEN 1
            ELSE attempts.attempts + 1
        END
    RETURNING attempts.attempts <= p_max_attempts INTO allowed;
    IF random() < 0.01 THEN
        DELETE FROM public."Tiendas_Pin_Login_Attempts"
        WHERE window_started_at < now() - interval '1 day';
    END IF;
    RETURN coalesce(allowed, false);
END;
$$;
REVOKE ALL ON FUNCTION public.staffplanner_pin_login_attempt(text, integer)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staffplanner_pin_login_attempt(text, integer)
    TO service_role;

CREATE TABLE IF NOT EXISTS public."Tiendas_Impulsadoras_Proveedores" (
    impulsadora_id integer NOT NULL
        REFERENCES public."Tiendas_Impulsadoras" (id) ON DELETE CASCADE,
    id_proveedor integer NOT NULL CHECK (id_proveedor > 0),
    es_principal boolean NOT NULL DEFAULT false,
    creado_en timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (impulsadora_id, id_proveedor)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_impulsadora_proveedor_principal
    ON public."Tiendas_Impulsadoras_Proveedores" (impulsadora_id)
    WHERE es_principal;

CREATE INDEX IF NOT EXISTS idx_impulsadora_proveedores_proveedor
    ON public."Tiendas_Impulsadoras_Proveedores" (id_proveedor, impulsadora_id);

UPDATE public."Tiendas_Impulsadoras_Proveedores" links
SET es_principal = false,
    actualizado_en = now()
FROM public."Tiendas_Impulsadoras" promoter
WHERE promoter.id = links.impulsadora_id
  AND promoter."idProveedor" IS NOT NULL
  AND links.es_principal IS TRUE
  AND links.id_proveedor <> promoter."idProveedor";

INSERT INTO public."Tiendas_Impulsadoras_Proveedores" (
    impulsadora_id, id_proveedor, es_principal
)
SELECT id, "idProveedor", true
FROM public."Tiendas_Impulsadoras"
WHERE "idProveedor" IS NOT NULL AND "idProveedor" > 0
ON CONFLICT (impulsadora_id, id_proveedor) DO UPDATE
SET es_principal = true,
    actualizado_en = now();

-- Yuleissi works for both MACRONEGOCIOS (legacy primary) and DMUJERES.
INSERT INTO public."Tiendas_Impulsadoras_Proveedores" (
    impulsadora_id, id_proveedor, es_principal
)
SELECT id, 23, false
FROM public."Tiendas_Impulsadoras"
WHERE id = 1
  AND "idVendedor" = 12
  AND upper(coalesce(nombre_completo, '')) LIKE '%YULEISSI%'
ON CONFLICT (impulsadora_id, id_proveedor) DO NOTHING;

ALTER TABLE public."Tiendas_Impulsadoras_Proveedores" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."Tiendas_Impulsadoras_Proveedores" FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE
    ON public."Tiendas_Impulsadoras_Proveedores" TO authenticated;
GRANT ALL ON public."Tiendas_Impulsadoras_Proveedores" TO service_role;

DROP POLICY IF EXISTS "impulsadora_proveedores_select_staff"
    ON public."Tiendas_Impulsadoras_Proveedores";
CREATE POLICY "impulsadora_proveedores_select_staff"
    ON public."Tiendas_Impulsadoras_Proveedores"
    FOR SELECT TO authenticated
    USING (private.staffplanner_role_id() IN (1, 2, 3));

DROP POLICY IF EXISTS "impulsadora_proveedores_write_managers"
    ON public."Tiendas_Impulsadoras_Proveedores";
CREATE POLICY "impulsadora_proveedores_write_managers"
    ON public."Tiendas_Impulsadoras_Proveedores"
    FOR ALL TO authenticated
    USING (private.staffplanner_role_id() IN (1, 2))
    WITH CHECK (private.staffplanner_role_id() IN (1, 2));

CREATE OR REPLACE FUNCTION public.establecer_impulsadora_proveedores(
    p_impulsadora_id integer,
    p_provider_ids integer[],
    p_primary_provider_id integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    normalized_ids integer[];
BEGIN
    IF private.staffplanner_role_id() NOT IN (1, 2) THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;

    SELECT array_agg(DISTINCT provider_id ORDER BY provider_id)
      INTO normalized_ids
      FROM unnest(coalesce(p_provider_ids, ARRAY[]::integer[])) AS provider_id
     WHERE provider_id > 0;

    IF p_impulsadora_id IS NULL
       OR NOT EXISTS (
           SELECT 1 FROM public."Tiendas_Impulsadoras"
           WHERE id = p_impulsadora_id
       )
       OR coalesce(cardinality(normalized_ids), 0) = 0
       OR cardinality(normalized_ids) > 20
       OR NOT (p_primary_provider_id = ANY(normalized_ids)) THEN
        RAISE EXCEPTION 'Relación de proveedores no válida';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM unnest(normalized_ids) AS selected_provider_id
        WHERE NOT EXISTS (
            SELECT 1
            FROM public."Tiendas_Marcas_Proveedores" catalog
            WHERE catalog."idProveedor" = selected_provider_id
              AND catalog.activo IS TRUE
        )
    ) THEN
        RAISE EXCEPTION 'Uno de los proveedores no existe o está inactivo';
    END IF;

    UPDATE public."Tiendas_Impulsadoras_Proveedores"
       SET es_principal = false,
           actualizado_en = now()
     WHERE impulsadora_id = p_impulsadora_id
       AND es_principal IS TRUE;

    DELETE FROM public."Tiendas_Impulsadoras_Proveedores"
     WHERE impulsadora_id = p_impulsadora_id
       AND NOT (id_proveedor = ANY(normalized_ids));

    INSERT INTO public."Tiendas_Impulsadoras_Proveedores" (
        impulsadora_id, id_proveedor, es_principal
    )
    SELECT p_impulsadora_id, provider_id, provider_id = p_primary_provider_id
    FROM unnest(normalized_ids) AS provider_id
    ON CONFLICT (impulsadora_id, id_proveedor) DO UPDATE
    SET es_principal = EXCLUDED.es_principal,
        actualizado_en = now();
END;
$$;

REVOKE ALL ON FUNCTION public.establecer_impulsadora_proveedores(integer, integer[], integer)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.establecer_impulsadora_proveedores(integer, integer[], integer)
    TO authenticated;

COMMENT ON TABLE public."Tiendas_Impulsadoras_Proveedores"
IS 'Relación de proveedores de cada impulsadora; una fila puede marcarse como proveedor principal.';
