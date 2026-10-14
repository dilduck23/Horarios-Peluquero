-- Ventas diarias importadas desde PCGN. Solo roles administrativos pueden leerlas.
CREATE TABLE IF NOT EXISTS public."Tiendas_Ventas_Diarias" (
    fecha date NOT NULL,
    id_vendedor integer NOT NULL,
    nombre_vendedor text NOT NULL,
    facturas integer NOT NULL DEFAULT 0 CHECK (facturas >= 0),
    notas_credito integer NOT NULL DEFAULT 0 CHECK (notas_credito >= 0),
    ventas_brutas numeric(18,4) NOT NULL DEFAULT 0,
    devoluciones numeric(18,4) NOT NULL DEFAULT 0,
    ventas_netas numeric(18,4) NOT NULL DEFAULT 0,
    items_netos numeric(18,4) NOT NULL DEFAULT 0,
    items_obsequio numeric(18,4) NOT NULL DEFAULT 0,
    sincronizado_en timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (fecha, id_vendedor)
);

CREATE TABLE IF NOT EXISTS public."Tiendas_Ventas_Diarias_Productos" (
    fecha date NOT NULL,
    id_vendedor integer NOT NULL,
    id_proveedor integer NOT NULL,
    proveedor text NOT NULL,
    codigo_producto text NOT NULL,
    producto text NOT NULL,
    cantidad_neta numeric(18,4) NOT NULL DEFAULT 0,
    venta_neta numeric(18,4) NOT NULL DEFAULT 0,
    sincronizado_en timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (fecha, id_vendedor, id_proveedor, codigo_producto),
    FOREIGN KEY (fecha, id_vendedor)
        REFERENCES public."Tiendas_Ventas_Diarias" (fecha, id_vendedor)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public."Tiendas_Ventas_Sincronizaciones" (
    fecha date PRIMARY KEY,
    estado text NOT NULL CHECK (estado IN ('completado', 'error')),
    vendedores integer NOT NULL DEFAULT 0,
    productos integer NOT NULL DEFAULT 0,
    mensaje text,
    sincronizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ventas_diarias_vendedor_fecha
    ON public."Tiendas_Ventas_Diarias" (id_vendedor, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_productos_vendedor_proveedor_fecha
    ON public."Tiendas_Ventas_Diarias_Productos" (id_vendedor, id_proveedor, fecha DESC);

ALTER TABLE public."Tiendas_Ventas_Diarias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Tiendas_Ventas_Diarias_Productos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Tiendas_Ventas_Sincronizaciones" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."Tiendas_Ventas_Diarias" FROM PUBLIC, anon;
REVOKE ALL ON public."Tiendas_Ventas_Diarias_Productos" FROM PUBLIC, anon;
REVOKE ALL ON public."Tiendas_Ventas_Sincronizaciones" FROM PUBLIC, anon;
GRANT SELECT ON public."Tiendas_Ventas_Diarias" TO authenticated;
GRANT SELECT ON public."Tiendas_Ventas_Diarias_Productos" TO authenticated;
GRANT SELECT ON public."Tiendas_Ventas_Sincronizaciones" TO authenticated;
GRANT ALL ON public."Tiendas_Ventas_Diarias" TO service_role;
GRANT ALL ON public."Tiendas_Ventas_Diarias_Productos" TO service_role;
GRANT ALL ON public."Tiendas_Ventas_Sincronizaciones" TO service_role;

DROP POLICY IF EXISTS "ventas_diarias_select_managers" ON public."Tiendas_Ventas_Diarias";
CREATE POLICY "ventas_diarias_select_managers"
    ON public."Tiendas_Ventas_Diarias" FOR SELECT TO authenticated
    USING (private.staffplanner_role_id() IN (1, 2));

DROP POLICY IF EXISTS "ventas_productos_select_managers" ON public."Tiendas_Ventas_Diarias_Productos";
CREATE POLICY "ventas_productos_select_managers"
    ON public."Tiendas_Ventas_Diarias_Productos" FOR SELECT TO authenticated
    USING (private.staffplanner_role_id() IN (1, 2));

DROP POLICY IF EXISTS "ventas_sync_select_managers" ON public."Tiendas_Ventas_Sincronizaciones";
CREATE POLICY "ventas_sync_select_managers"
    ON public."Tiendas_Ventas_Sincronizaciones" FOR SELECT TO authenticated
    USING (private.staffplanner_role_id() IN (1, 2));

-- Una sola llamada reemplaza el día dentro de la misma transacción.
CREATE OR REPLACE FUNCTION public.sincronizar_ventas_diarias(
    p_fecha date,
    p_ventas jsonb,
    p_productos jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_vendedores integer := 0;
    v_productos integer := 0;
BEGIN
    DELETE FROM public."Tiendas_Ventas_Diarias" WHERE fecha = p_fecha;

    INSERT INTO public."Tiendas_Ventas_Diarias" (
        fecha, id_vendedor, nombre_vendedor, facturas, notas_credito,
        ventas_brutas, devoluciones, ventas_netas, items_netos, items_obsequio, sincronizado_en
    )
    SELECT p_fecha, x.id_vendedor, x.nombre_vendedor, x.facturas, x.notas_credito,
           x.ventas_brutas, x.devoluciones, x.ventas_netas, x.items_netos, x.items_obsequio, now()
    FROM jsonb_to_recordset(COALESCE(p_ventas, '[]'::jsonb)) AS x(
        id_vendedor integer, nombre_vendedor text, facturas integer, notas_credito integer,
        ventas_brutas numeric, devoluciones numeric, ventas_netas numeric,
        items_netos numeric, items_obsequio numeric
    );
    GET DIAGNOSTICS v_vendedores = ROW_COUNT;

    INSERT INTO public."Tiendas_Ventas_Diarias_Productos" (
        fecha, id_vendedor, id_proveedor, proveedor, codigo_producto,
        producto, cantidad_neta, venta_neta, sincronizado_en
    )
    SELECT p_fecha, x.id_vendedor, x.id_proveedor, x.proveedor, x.codigo_producto,
           x.producto, x.cantidad_neta, x.venta_neta, now()
    FROM jsonb_to_recordset(COALESCE(p_productos, '[]'::jsonb)) AS x(
        id_vendedor integer, id_proveedor integer, proveedor text, codigo_producto text,
        producto text, cantidad_neta numeric, venta_neta numeric
    );
    GET DIAGNOSTICS v_productos = ROW_COUNT;

    INSERT INTO public."Tiendas_Ventas_Sincronizaciones" (fecha, estado, vendedores, productos, mensaje, sincronizado_en)
    VALUES (p_fecha, 'completado', v_vendedores, v_productos, NULL, now())
    ON CONFLICT (fecha) DO UPDATE SET
        estado = EXCLUDED.estado,
        vendedores = EXCLUDED.vendedores,
        productos = EXCLUDED.productos,
        mensaje = NULL,
        sincronizado_en = EXCLUDED.sincronizado_en;

    RETURN jsonb_build_object('fecha', p_fecha, 'vendedores', v_vendedores, 'productos', v_productos);
END;
$$;

REVOKE ALL ON FUNCTION public.sincronizar_ventas_diarias(date, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sincronizar_ventas_diarias(date, jsonb, jsonb) TO service_role;

COMMENT ON TABLE public."Tiendas_Ventas_Diarias" IS 'Resumen neto diario por vendedor importado desde PCGN.';
COMMENT ON COLUMN public."Tiendas_Ventas_Diarias".items_netos IS 'Cantidad de items, excluyendo líneas cuya descripción contiene [OBSEQUIO].';
COMMENT ON FUNCTION public.sincronizar_ventas_diarias(date, jsonb, jsonb) IS 'Reemplazo transaccional e idempotente de ventas para una fecha; exclusivo de service_role.';
