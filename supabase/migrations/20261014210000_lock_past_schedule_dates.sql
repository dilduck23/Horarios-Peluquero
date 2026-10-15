-- Las fechas anteriores a hoy (America/Guayaquil) son históricas y de solo lectura.
CREATE OR REPLACE FUNCTION private.prevent_past_schedule_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    current_ecuador_date date := (now() AT TIME ZONE 'America/Guayaquil')::date;
    existing_date date;
    requested_date date;
BEGIN
    existing_date := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.fecha ELSE NULL END;
    requested_date := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.fecha ELSE NULL END;

    IF existing_date IS NOT NULL AND existing_date < current_ecuador_date THEN
        RAISE EXCEPTION 'Las fechas anteriores ya no se pueden modificar.' USING ERRCODE = 'P0001';
    END IF;

    IF requested_date IS NOT NULL AND requested_date < current_ecuador_date THEN
        RAISE EXCEPTION 'No se pueden crear ni mover asignaciones hacia fechas anteriores.' USING ERRCODE = 'P0001';
    END IF;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

REVOKE ALL ON FUNCTION private.prevent_past_schedule_changes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS protect_past_promoter_schedule ON public."Tiendas_Horario";
CREATE TRIGGER protect_past_promoter_schedule
BEFORE INSERT OR UPDATE OR DELETE ON public."Tiendas_Horario"
FOR EACH ROW EXECUTE FUNCTION private.prevent_past_schedule_changes();

DROP TRIGGER IF EXISTS protect_past_internal_schedule ON public."Tiendas_Personal_Horario";
CREATE TRIGGER protect_past_internal_schedule
BEFORE INSERT OR UPDATE OR DELETE ON public."Tiendas_Personal_Horario"
FOR EACH ROW EXECUTE FUNCTION private.prevent_past_schedule_changes();

COMMENT ON FUNCTION private.prevent_past_schedule_changes() IS
'Bloquea INSERT, UPDATE y DELETE de horarios anteriores a la fecha oficial de Ecuador.';
