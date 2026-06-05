-- =====================================================
-- REMOCION AUDITADA DE FALTAS
-- Ejecutar en Supabase SQL Editor despues de los scripts base.
-- =====================================================

CREATE OR REPLACE FUNCTION public.staffplanner_remove_absence(
    p_incident_id INTEGER,
    p_reason TEXT,
    p_user_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user public."Tiendas_Usuarios"%ROWTYPE;
    v_incident public."Tiendas_Faltas"%ROWTYPE;
    v_schedule public."Tiendas_Horario"%ROWTYPE;
    v_attendance public."Tiendas_Asistencia"%ROWTYPE;
    v_person_name TEXT := 'Desconocido';
    v_store_name TEXT := 'Desconocida';
    v_reason TEXT := btrim(coalesce(p_reason, ''));
    v_now TIMESTAMPTZ := now();
    v_attendance_corrected BOOLEAN := false;
BEGIN
    IF p_incident_id IS NULL OR p_incident_id <= 0 THEN
        RAISE EXCEPTION 'INCIDENT_ID_REQUIRED';
    END IF;

    IF length(v_reason) < 5 THEN
        RAISE EXCEPTION 'REASON_REQUIRED';
    END IF;

    SELECT *
    INTO v_user
    FROM public."Tiendas_Usuarios"
    WHERE lower(email) = lower(coalesce(p_user_email, ''))
      AND activo IS TRUE
    LIMIT 1;

    IF NOT FOUND OR v_user.id_rol <> 1 THEN
        RAISE EXCEPTION 'FORBIDDEN';
    END IF;

    SELECT *
    INTO v_incident
    FROM public."Tiendas_Faltas"
    WHERE id = p_incident_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND';
    END IF;

    IF upper(coalesce(v_incident.asunto, '')) NOT LIKE '%FALTA%' THEN
        RAISE EXCEPTION 'ONLY_ABSENCES';
    END IF;

    IF v_incident.id_horario IS NOT NULL THEN
        SELECT *
        INTO v_schedule
        FROM public."Tiendas_Horario"
        WHERE id = v_incident.id_horario;

        SELECT a.*
        INTO v_attendance
        FROM public."Tiendas_Asistencia" a
        WHERE a.falta_id = p_incident_id
           OR a.horario_id = v_incident.id_horario
        ORDER BY CASE WHEN a.falta_id = p_incident_id THEN 0 ELSE 1 END
        LIMIT 1
        FOR UPDATE;
    END IF;

    IF v_attendance.id IS NOT NULL
       AND (v_attendance.falta_id = p_incident_id OR v_attendance.estado = 'falta_generada') THEN
        UPDATE public."Tiendas_Asistencia"
        SET estado = 'aprobada',
            aprobado_por = coalesce(aprobado_por, v_user.id),
            aprobado_en = coalesce(aprobado_en, v_now),
            cerrado_en = NULL,
            falta_id = NULL,
            correo_falta_auto_enviado_en = NULL,
            actualizado_en = v_now
        WHERE id = v_attendance.id;
        v_attendance_corrected := true;
    ELSIF v_schedule.id IS NOT NULL
          AND upper(coalesce(v_incident.asunto, '')) = 'FALTA NO APROBADA' THEN
        INSERT INTO public."Tiendas_Asistencia" (
            horario_id,
            impulsadora_id,
            tienda_id,
            fecha,
            estado,
            aprobado_por,
            aprobado_en,
            cerrado_en,
            falta_id,
            actualizado_en,
            creado_en
        )
        VALUES (
            v_schedule.id,
            v_schedule.impulsadora_id,
            v_schedule.tienda_id,
            v_schedule.fecha,
            'aprobada',
            v_user.id,
            v_now,
            NULL,
            NULL,
            v_now,
            v_now
        )
        ON CONFLICT (horario_id) DO UPDATE
        SET estado = 'aprobada',
            aprobado_por = coalesce(public."Tiendas_Asistencia".aprobado_por, EXCLUDED.aprobado_por),
            aprobado_en = coalesce(public."Tiendas_Asistencia".aprobado_en, EXCLUDED.aprobado_en),
            cerrado_en = NULL,
            falta_id = NULL,
            correo_falta_auto_enviado_en = NULL,
            actualizado_en = EXCLUDED.actualizado_en;
        v_attendance_corrected := true;
    END IF;

    DELETE FROM public."Tiendas_Faltas"
    WHERE id = p_incident_id;

    IF v_schedule.impulsadora_id IS NOT NULL THEN
        SELECT nombre_completo
        INTO v_person_name
        FROM public."Tiendas_Impulsadoras"
        WHERE id = v_schedule.impulsadora_id;
    END IF;

    IF v_schedule.tienda_id IS NOT NULL THEN
        SELECT nombre_display
        INTO v_store_name
        FROM public."Tiendas_Razonamiento"
        WHERE id = v_schedule.tienda_id;
    END IF;

    INSERT INTO public."Tiendas_Registros" (
        id_usuario,
        email_usuario,
        accion,
        entidad,
        id_registro,
        descripcion,
        datos_json,
        creado_en
    )
    VALUES (
        v_user.id,
        v_user.email,
        'ELIMINAR',
        'Tiendas_Faltas',
        p_incident_id,
        concat('Removio falta de ', coalesce(v_person_name, 'Desconocido'), ' en ', coalesce(v_store_name, 'Desconocida'), '. Motivo: ', v_reason),
        jsonb_build_object(
            'motivo', v_reason,
            'falta', to_jsonb(v_incident),
            'horario', to_jsonb(v_schedule),
            'asistencia_corregida', v_attendance_corrected
        ),
        v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'incident_id', p_incident_id,
        'attendance_corrected', v_attendance_corrected
    );
END;
$$;

REVOKE ALL ON FUNCTION public.staffplanner_remove_absence(INTEGER, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staffplanner_remove_absence(INTEGER, TEXT, TEXT) TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."Tiendas_Faltas" TO service_role;
GRANT INSERT ON public."Tiendas_Registros" TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public."Tiendas_Registros_id_seq" TO service_role;
