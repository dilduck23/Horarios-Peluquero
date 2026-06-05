import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

function statusFromRpcError(message: string) {
  if (message.includes("FORBIDDEN")) return 403;
  if (message.includes("NOT_FOUND")) return 404;
  if (message.includes("ONLY_ABSENCES") || message.includes("REASON_REQUIRED") || message.includes("INCIDENT_ID_REQUIRED")) return 400;
  return 500;
}

function friendlyError(message: string) {
  if (message.includes("FORBIDDEN")) return "Solo el Administrador puede remover faltas.";
  if (message.includes("NOT_FOUND")) return "La falta ya no existe o fue removida.";
  if (message.includes("ONLY_ABSENCES")) return "Solo se pueden remover registros marcados como falta.";
  if (message.includes("REASON_REQUIRED")) return "El motivo es obligatorio.";
  if (message.includes("INCIDENT_ID_REQUIRED")) return "La falta no es válida.";
  return message || "No se pudo remover la falta.";
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

    const authorization = req.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const incidentId = asInt(body?.incidentId);
    const reason = asText(body?.reason).trim();
    if (!incidentId || reason.length < 5) {
      return jsonResponse({ error: "El motivo es obligatorio." }, 400);
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

    const { data, error } = await adminClient.rpc("staffplanner_remove_absence", {
      p_incident_id: incidentId,
      p_reason: reason,
      p_user_email: authEmail,
    });

    if (error) {
      const message = error.message || "";
      return jsonResponse({ error: friendlyError(message) }, statusFromRpcError(message));
    }

    return jsonResponse({ success: true, data });
  } catch (error) {
    console.error("remove-absence error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
