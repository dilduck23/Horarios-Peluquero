import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const tableAttendance = "Tiendas_Asistencia";
const tableSchedule = "Tiendas_Horario";

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

function getServiceKey() {
  return Deno.env.get("SUPABASE_SECRET_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    valuesFromJsonEnv("SUPABASE_SECRET_KEYS")[0];
}

function validDateKey(value: unknown) {
  const text = asText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
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
    const SUPABASE_SERVICE_ROLE_KEY = getServiceKey();
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase service credentials are not configured");
    }

    const body = await req.json();
    const impulsadoraId = asInt(body?.impulsadoraId);
    const from = validDateKey(body?.from);
    const to = validDateKey(body?.to);
    if (!impulsadoraId || !from || !to || from > to) {
      return jsonResponse({ error: "impulsadoraId, from and to are required" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: schedules, error: scheduleError } = await supabase
      .from(tableSchedule)
      .select("id")
      .eq("impulsadora_id", impulsadoraId)
      .gte("fecha", from)
      .lte("fecha", to);
    if (scheduleError) throw scheduleError;

    const scheduleIds = (schedules || []).map((row) => asInt(row.id)).filter(Boolean);
    if (!scheduleIds.length) {
      return jsonResponse({ success: true, attendance: [] });
    }

    const { data: attendance, error: attendanceError } = await supabase
      .from(tableAttendance)
      .select("horario_id,estado,aprobado_en,cerrado_en")
      .in("horario_id", scheduleIds);
    if (attendanceError) throw attendanceError;

    return jsonResponse({ success: true, attendance: attendance || [] });
  } catch (error) {
    console.error("self-attendance-status error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
