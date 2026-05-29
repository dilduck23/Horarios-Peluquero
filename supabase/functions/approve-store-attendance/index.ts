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
    if (!horarioId) {
      return jsonResponse({ error: "horarioId is required" }, 400);
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

    const { data: existing, error: existingError } = await adminClient
      .from(tableAttendance)
      .select("*")
      .eq("horario_id", horarioId)
      .maybeSingle();
    if (existingError) throw existingError;

    if (asText(recordValue(existing, "estado")) === "falta_generada" || recordValue(existing, "falta_id")) {
      return jsonResponse({ error: "La asistencia ya fue cerrada como falta" }, 409);
    }

    if (asText(recordValue(existing, "estado")) === "aprobada") {
      return jsonResponse({ success: true, attendance: existing, alreadyApproved: true });
    }

    const now = new Date().toISOString();
    const payload = {
      horario_id: horarioId,
      impulsadora_id: asInt(recordValue(schedule, "impulsadora_id")),
      tienda_id: scheduleStoreId,
      fecha: asText(recordValue(schedule, "fecha")),
      estado: "aprobada",
      aprobado_por: asInt(recordValue(reporter, "id")),
      aprobado_en: now,
      cerrado_en: null,
      falta_id: null,
      actualizado_en: now,
    };

    const query = existing
      ? adminClient.from(tableAttendance).update(payload).eq("horario_id", horarioId)
      : adminClient.from(tableAttendance).insert({ ...payload, creado_en: now });

    const { data: attendance, error: attendanceError } = await query.select("*").single();
    if (attendanceError) throw attendanceError;

    return jsonResponse({ success: true, attendance });
  } catch (error) {
    console.error("approve-store-attendance error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
