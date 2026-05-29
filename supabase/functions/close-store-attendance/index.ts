import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const tableAttendance = "Tiendas_Asistencia";
const tableIncidents = "Tiendas_Faltas";
const tableSchedule = "Tiendas_Horario";
const autoSubject = "FALTA NO APROBADA";
const autoObservation = "Falta automatica: el punto de venta no aprobo la asistencia antes de las 20:00 America/Guayaquil.";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

function asText(value: unknown, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function asInt(value: unknown, fallback = 0) {
  const parsed = Number.parseInt(asText(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function recordValue(record: Record<string, unknown> | null | undefined, key: string) {
  return record ? record[key] : undefined;
}

function valuesFromJsonEnv(envName: string) {
  const raw = Deno.env.get(envName);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.values(parsed).map((value) => asText(value)).filter(Boolean);
  } catch {
    return [];
  }
}

function serviceKeys() {
  return [
    Deno.env.get("SUPABASE_SECRET_KEY"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    ...valuesFromJsonEnv("SUPABASE_SECRET_KEYS"),
  ].map((value) => asText(value)).filter(Boolean);
}

function getServiceKey() {
  return serviceKeys()[0];
}

function requestKeys(req: Request) {
  const apikey = asText(req.headers.get("apikey"));
  const bearer = asText(req.headers.get("Authorization")).replace(/^Bearer\s+/i, "").trim();
  return [apikey, bearer].filter(Boolean);
}

function knownServiceKey(req: Request) {
  const keys = new Set(serviceKeys());
  return requestKeys(req).find((key) => keys.has(key));
}

async function canWriteAttendance(supabaseUrl: string, key: string) {
  const probeClient = createClient(supabaseUrl, key, { auth: { persistSession: false } });
  const { error } = await probeClient
    .from(tableAttendance)
    .update({ actualizado_en: new Date().toISOString() })
    .eq("id", -1);
  return !error;
}

async function authorizedServiceKey(req: Request, supabaseUrl: string) {
  const envServiceKey = getServiceKey();
  const matchedEnvKey = knownServiceKey(req);
  if (matchedEnvKey) return envServiceKey || matchedEnvKey;

  for (const key of requestKeys(req)) {
    if (await canWriteAttendance(supabaseUrl, key)) return key;
  }

  return "";
}

function ecuadorDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function parseBody(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    if (!SUPABASE_URL) {
      throw new Error("Supabase URL is not configured");
    }

    const SUPABASE_SERVICE_ROLE_KEY = await authorizedServiceKey(req, SUPABASE_URL);
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await parseBody(req);
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(asText(body?.fecha))
      ? asText(body.fecha)
      : ecuadorDateKey();
    const now = new Date().toISOString();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: schedules, error: scheduleError } = await supabase
      .from(tableSchedule)
      .select("id,fecha,tienda_id,impulsadora_id")
      .eq("fecha", fecha);
    if (scheduleError) throw scheduleError;

    const scheduleRows = schedules || [];
    const scheduleIds = scheduleRows.map((row) => asInt(recordValue(row, "id"))).filter(Boolean);
    if (!scheduleIds.length) {
      return jsonResponse({ success: true, fecha, total: 0, approved: 0, generated: 0, skipped: 0 });
    }

    const [attendanceResult, incidentResult] = await Promise.all([
      supabase.from(tableAttendance).select("*").in("horario_id", scheduleIds),
      supabase.from(tableIncidents).select("id,id_horario,asunto").in("id_horario", scheduleIds).eq("asunto", autoSubject),
    ]);
    if (attendanceResult.error) throw attendanceResult.error;
    if (incidentResult.error) throw incidentResult.error;

    const attendanceBySchedule = new Map<number, Record<string, unknown>>();
    (attendanceResult.data || []).forEach((row) => attendanceBySchedule.set(asInt(recordValue(row, "horario_id")), row));

    const incidentBySchedule = new Map<number, Record<string, unknown>>();
    (incidentResult.data || []).forEach((row) => incidentBySchedule.set(asInt(recordValue(row, "id_horario")), row));

    let approved = 0;
    let generated = 0;
    let skipped = 0;

    for (const schedule of scheduleRows) {
      const horarioId = asInt(recordValue(schedule, "id"));
      const existingAttendance = attendanceBySchedule.get(horarioId);

      if (asText(recordValue(existingAttendance, "estado")) === "aprobada") {
        approved += 1;
        if (!recordValue(existingAttendance, "cerrado_en")) {
          await supabase
            .from(tableAttendance)
            .update({ cerrado_en: now, actualizado_en: now })
            .eq("horario_id", horarioId)
            .eq("estado", "aprobada");
        }
        continue;
      }

      const alreadyClosed = asText(recordValue(existingAttendance, "estado")) === "falta_generada"
        && recordValue(existingAttendance, "falta_id");
      if (alreadyClosed) {
        skipped += 1;
        continue;
      }

      let incident = incidentBySchedule.get(horarioId);
      if (!incident) {
        const { data: insertedIncident, error: incidentError } = await supabase
          .from(tableIncidents)
          .insert({
            id_horario: horarioId,
            asunto: autoSubject,
            observacion: autoObservation,
          })
          .select("id,id_horario,asunto")
          .single();

        if (incidentError && incidentError.code !== "23505") throw incidentError;
        if (incidentError?.code === "23505") {
          const { data: existingIncident, error: existingIncidentError } = await supabase
            .from(tableIncidents)
            .select("id,id_horario,asunto")
            .eq("id_horario", horarioId)
            .eq("asunto", autoSubject)
            .maybeSingle();
          if (existingIncidentError) throw existingIncidentError;
          incident = existingIncident || undefined;
        } else {
          incident = insertedIncident || undefined;
        }
      }

      const incidentId = asInt(recordValue(incident, "id"));
      if (!incidentId) {
        throw new Error(`Could not create automatic incident for schedule ${horarioId}`);
      }

      const attendancePayload = {
        horario_id: horarioId,
        impulsadora_id: asInt(recordValue(schedule, "impulsadora_id")),
        tienda_id: asInt(recordValue(schedule, "tienda_id")),
        fecha: asText(recordValue(schedule, "fecha")),
        estado: "falta_generada",
        cerrado_en: now,
        falta_id: incidentId,
        actualizado_en: now,
      };

      if (existingAttendance) {
        const { error: updateError } = await supabase
          .from(tableAttendance)
          .update(attendancePayload)
          .eq("horario_id", horarioId)
          .neq("estado", "aprobada");
        if (updateError) throw updateError;
      } else {
        const { error: insertAttendanceError } = await supabase
          .from(tableAttendance)
          .insert({ ...attendancePayload, creado_en: now });
        if (insertAttendanceError && insertAttendanceError.code !== "23505") throw insertAttendanceError;
      }

      generated += 1;
    }

    return jsonResponse({
      success: true,
      fecha,
      total: scheduleRows.length,
      approved,
      generated,
      skipped,
    });
  } catch (error) {
    console.error("close-store-attendance error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
