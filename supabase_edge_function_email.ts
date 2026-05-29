import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const tableSchedule = "Tiendas_Horario";
const tablePromoters = "Tiendas_Impulsadoras";
const tableStores = "Tiendas_Razonamiento";
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

function recordValue(record: Record<string, unknown> | null | undefined, key: string) {
  return record ? record[key] : undefined;
}

function valueFromJsonEnv(envName: string) {
  const raw = Deno.env.get(envName);
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const values = Object.values(parsed).map((value) => asText(value)).filter(Boolean);
    return values[0] || "";
  } catch {
    return "";
  }
}

function getSupabasePublishableKey() {
  return Deno.env.get("SUPABASE_ANON_KEY") || valueFromJsonEnv("SUPABASE_PUBLISHABLE_KEYS");
}

function getSupabaseServiceKey() {
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || valueFromJsonEnv("SUPABASE_SECRET_KEYS");
}

function escapeHtml(value: unknown) {
  return asText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeKey(value: unknown) {
  return asText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

function uniqueEmails(values: unknown[]) {
  const seen = new Set<string>();
  const emails: string[] = [];
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  values.flat().forEach((value) => {
    const email = asText(value).trim().toLowerCase();
    if (!email || !emailPattern.test(email) || seen.has(email)) return;
    seen.add(email);
    emails.push(email);
  });

  return emails;
}

function formatDate(value: unknown) {
  const dateStr = asText(value);
  if (!dateStr.includes("-")) return dateStr;
  const parts = dateStr.slice(0, 10).split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function incidenceDisplay(value: unknown) {
  const tipoTexto: Record<string, string> = {
    FALTA: "No se presentó (Falta)",
    FALTA_INJUSTIFICADA: "Falta injustificada",
    FALTA_JUSTIFICADA: "Falta justificada",
    TARDANZA: "Llegó tarde",
    IMPUNTUALIDAD: "Impuntualidad",
    SALIDA_TEMPRANA: "Salió antes de tiempo",
    PRESENTACION: "Presentación",
    ACTITUD: "Actitud",
    QUEJA_DE_CLIENTE: "Queja de cliente",
    OTRO: "Otro",
    OTROS: "Otros",
  };

  const key = normalizeKey(value);
  return tipoTexto[key] || asText(value, "Incidencia");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = getSupabaseServiceKey();
    const SUPABASE_PUBLISHABLE_KEY = getSupabasePublishableKey();
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_PUBLISHABLE_KEY) {
      throw new Error("Supabase service credentials are not configured");
    }

    const body = await req.json();
    const authorization = req.headers.get("Authorization") || "";
    const authToken = authorization.replace(/^Bearer\s+/i, "").trim();
    const userClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authorization } },
    });
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser(authToken || undefined);
    const authEmail = authData.user?.email;
    if (authError || !authEmail) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: reporter, error: reporterError } = await supabase
      .from(tableUsers)
      .select("email,nombre,id_rol,id_tienda,activo")
      .eq("email", authEmail)
      .eq("activo", true)
      .maybeSingle();
    if (reporterError) throw reporterError;

    const reporterRole = Number(recordValue(reporter, "id_rol") ?? 0);
    if (!reporter || ![1, 2, 3].includes(reporterRole)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const {
      idHorario,
      scheduleId,
      incidenceType,
      observation,
      personName,
      dateStr,
      storeName,
      reportedBy,
      recipientEmails,
    } = body;

    const scheduleIdValue = Number(idHorario ?? scheduleId ?? 0);
    let schedule: Record<string, unknown> | null = null;
    let promoter: Record<string, unknown> | null = null;
    let store: Record<string, unknown> | null = null;
    let adminEmails: string[] = [];

    if ((!Number.isFinite(scheduleIdValue) || scheduleIdValue <= 0) && reporterRole === 3) {
      return jsonResponse({ error: "Schedule id is required" }, 403);
    }

    if (Number.isFinite(scheduleIdValue) && scheduleIdValue > 0) {
      const { data: scheduleData, error: scheduleError } = await supabase
        .from(tableSchedule)
        .select("*")
        .eq("id", scheduleIdValue)
        .maybeSingle();
      if (scheduleError) throw scheduleError;
      if (!scheduleData) return jsonResponse({ error: "Schedule not found" }, 404);
      schedule = scheduleData;

      const reporterStoreId = Number(recordValue(reporter, "id_tienda") ?? 0);
      const scheduleStoreId = Number(recordValue(scheduleData, "tienda_id") ?? 0);
      if (reporterRole === 3 && reporterStoreId !== scheduleStoreId) {
        return jsonResponse({ error: "Forbidden" }, 403);
      }

      const [promoterResult, storeResult, userResult] = await Promise.all([
        supabase
          .from(tablePromoters)
          .select("id,nombre_completo,Marca,Correo")
          .eq("id", recordValue(scheduleData, "impulsadora_id"))
          .maybeSingle(),
        supabase
          .from(tableStores)
          .select("id,nombre_display,alias_tienda")
          .eq("id", scheduleStoreId)
          .maybeSingle(),
        supabase
          .from(tableUsers)
          .select("email,nombre,id_rol,activo")
          .in("id_rol", [1, 2])
          .eq("activo", true),
      ]);

      if (promoterResult.error) throw promoterResult.error;
      if (storeResult.error) throw storeResult.error;
      if (userResult.error) throw userResult.error;

      promoter = promoterResult.data;
      store = storeResult.data;
      adminEmails = (userResult.data || []).map((user) => asText(recordValue(user, "email")));
    }

    const recipients = uniqueEmails([
      adminEmails,
      recordValue(promoter, "Correo"),
      scheduleIdValue > 0 ? [] : recipientEmails,
    ]);

    if (!recipients.length) {
      return jsonResponse({ error: "No recipient emails found" }, 422);
    }

    const tipoDisplay = incidenceDisplay(incidenceType);
    const safePersonName = escapeHtml(personName || recordValue(promoter, "nombre_completo") || "No especificado");
    const safeStoreName = escapeHtml(storeName || recordValue(store, "nombre_display") || "No especificada");
    const safeDate = escapeHtml(formatDate(dateStr || recordValue(schedule, "fecha") || ""));
    const safeObservation = escapeHtml(observation || "Sin observación");
    const safeReportedBy = escapeHtml(reportedBy || recordValue(reporter, "nombre") || authEmail);
    const safeTipoDisplay = escapeHtml(tipoDisplay);

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f9f9f9; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
            .header { background-color: #000000; padding: 20px; text-align: center; border-bottom: 4px solid #f20356; }
            .header h1 { color: white; margin: 0; font-size: 20px; font-weight: 700; }
            .content { padding: 30px; }
            .field { margin-bottom: 20px; padding: 15px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #f20356; }
            .field-label { font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 5px; }
            .field-value { font-size: 16px; color: #000000; font-weight: 500; }
            .observation { background: #fff1f2; border-left-color: #f20356; }
            .footer { background: #000000; color: #9ca3af; padding: 20px; text-align: center; font-size: 12px; }
            .highlight { color: #f20356; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Nueva incidencia reportada</h1>
            </div>
            <div class="content">
              <div class="field">
                <div class="field-label" style="color: #f20356;">Tipo de Incidencia</div>
                <div class="field-value highlight">${safeTipoDisplay}</div>
              </div>
              <div class="field">
                <div class="field-label">Personal</div>
                <div class="field-value">${safePersonName}</div>
              </div>
              <div class="field">
                <div class="field-label">Fecha</div>
                <div class="field-value">${safeDate || 'No especificada'}</div>
              </div>
              <div class="field">
                <div class="field-label">Tienda</div>
                <div class="field-value">${safeStoreName}</div>
              </div>
              <div class="field observation">
                <div class="field-label">Observación</div>
                <div class="field-value">${safeObservation}</div>
              </div>
              <div class="field">
                <div class="field-label">Reportado por</div>
                <div class="field-value">${safeReportedBy}</div>
              </div>
            </div>
            <div class="footer">
              <p>StaffPlanner - Control Peluquero</p>
              <p>Este es un mensaje automático, no responder.</p>
            </div>
          </div>
        </body>
        </html>
        `;

    const resendPayload = {
      from: "StaffPlanner <notificaciones@elpeluquero.ec>",
      to: recipients,
      subject: `Incidencia - ${asText(personName || recordValue(promoter, "nombre_completo"), "Personal")} - ${tipoDisplay}`,
      html: htmlContent,
    };

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(resendPayload),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || `Resend error: ${res.status}`);
    }

    return jsonResponse({ success: true, data, recipients: recipients.length });

  } catch (error) {
    console.error("Function error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: errorMessage }, 500);
  }
});
