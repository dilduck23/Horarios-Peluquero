import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const tableAttendance = "Tiendas_Asistencia";
const tableSchedule = "Tiendas_Horario";
const tableUsers = "Tiendas_Usuarios";

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

function getPublishableKey() {
  return Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ||
    Deno.env.get("SUPABASE_ANON_KEY") ||
    valuesFromJsonEnv("SUPABASE_PUBLISHABLE_KEYS")[0];
}

function getServiceKey() {
  return Deno.env.get("SUPABASE_SECRET_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    valuesFromJsonEnv("SUPABASE_SECRET_KEYS")[0];
}

function minutesBetween(start: string, end: string) {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(diff) || diff < 0) return null;
  return Math.max(0, Math.round(diff / 60000));
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_PUBLISHABLE_KEY = getPublishableKey();
    const SUPABASE_SERVICE_ROLE_KEY = getServiceKey();
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials are not configured");
    }

    const body = await req.json();
    const horarioId = asInt(body?.horarioId);
    const action = asText(body?.action).toLowerCase();
    if (!horarioId) {
      return jsonResponse({ error: "horarioId is required" }, 400);
    }
    if (!["salida", "ingreso"].includes(action)) {
      return jsonResponse({ error: "action must be salida or ingreso" }, 400);
    }

    const authorization = req.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authorization } },
    });
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    const authEmail = authData.user?.email;
    if (authError || !authEmail) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: reporter, error: reporterError } = await adminClient
      .from(tableUsers)
      .select("id,email,nombre,id_rol,id_tienda,activo")
      .eq("email", authEmail)
      .eq("activo", true)
      .maybeSingle();
    if (reporterError) throw reporterError;

    const reporterRole = asInt(recordValue(reporter, "id_rol"));
    if (!reporter || ![1, 2, 3].includes(reporterRole)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const { data: schedule, error: scheduleError } = await adminClient
      .from(tableSchedule)
      .select("id,fecha,tienda_id,impulsadora_id")
      .eq("id", horarioId)
      .maybeSingle();
    if (scheduleError) throw scheduleError;
    if (!schedule) {
      return jsonResponse({ error: "Schedule not found" }, 404);
    }

    const scheduleStoreId = asInt(recordValue(schedule, "tienda_id"));
    const reporterStoreId = asInt(recordValue(reporter, "id_tienda"));
    if (reporterRole === 3 && scheduleStoreId !== reporterStoreId) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    if (asText(recordValue(schedule, "fecha")) !== ecuadorDateKey()) {
      return jsonResponse({ error: "Solo puedes marcar almuerzo de hoy." }, 409);
    }

    const { data: existing, error: existingError } = await adminClient
      .from(tableAttendance)
      .select("*")
      .eq("horario_id", horarioId)
      .maybeSingle();
    if (existingError) throw existingError;

    if (!existing || asText(recordValue(existing, "estado")) !== "aprobada") {
      return jsonResponse({ error: "Primero aprueba la asistencia." }, 409);
    }

    const lunchOut = asText(recordValue(existing, "almuerzo_salida_en"));
    const lunchIn = asText(recordValue(existing, "almuerzo_ingreso_en"));
    const now = new Date().toISOString();

    if (action === "salida") {
      if (lunchOut) {
        return jsonResponse({ success: true, attendance: existing, alreadyMarked: true });
      }

      const { data: attendance, error: updateError } = await adminClient
        .from(tableAttendance)
        .update({ almuerzo_salida_en: now, almuerzo_minutos: null, actualizado_en: now })
        .eq("horario_id", horarioId)
        .is("almuerzo_salida_en", null)
        .select("*")
        .maybeSingle();
      if (updateError) throw updateError;
      if (!attendance) {
        const { data: refreshed, error: refreshError } = await adminClient
          .from(tableAttendance)
          .select("*")
          .eq("horario_id", horarioId)
          .maybeSingle();
        if (refreshError) throw refreshError;
        return jsonResponse({ success: true, attendance: refreshed || existing, alreadyMarked: true });
      }

      return jsonResponse({ success: true, attendance });
    }

    if (!lunchOut) {
      return jsonResponse({ error: "Marca primero la salida de almuerzo." }, 409);
    }
    if (lunchIn) {
      return jsonResponse({ success: true, attendance: existing, alreadyMarked: true });
    }

    const lunchMinutes = minutesBetween(lunchOut, now);
    const { data: attendance, error: updateError } = await adminClient
      .from(tableAttendance)
      .update({
        almuerzo_ingreso_en: now,
        almuerzo_minutos: lunchMinutes,
        actualizado_en: now,
      })
      .eq("horario_id", horarioId)
      .is("almuerzo_ingreso_en", null)
      .select("*")
      .maybeSingle();
    if (updateError) throw updateError;
    if (!attendance) {
      const { data: refreshed, error: refreshError } = await adminClient
        .from(tableAttendance)
        .select("*")
        .eq("horario_id", horarioId)
        .maybeSingle();
      if (refreshError) throw refreshError;
      return jsonResponse({ success: true, attendance: refreshed || existing, alreadyMarked: true });
    }

    return jsonResponse({ success: true, attendance });
  } catch (error) {
    console.error("mark-store-lunch error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
