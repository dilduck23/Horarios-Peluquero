import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const tableAttendance = "Tiendas_Asistencia";
const tableIncidents = "Tiendas_Faltas";
const tablePromoters = "Tiendas_Impulsadoras";
const tableStores = "Tiendas_Razonamiento";
const tableSchedule = "Tiendas_Horario";
const tableUsers = "Tiendas_Usuarios";
const autoSubject = "FALTA NO APROBADA";
const autoObservation = "Falta automatica: el punto de venta no aprobo la asistencia antes de las 20:00 America/Guayaquil.";
const blockedRecipientEmails = new Set([
  "croman@novepsa.com",
  "liglesias@novepsa.com",
]);

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

function escapeHtml(value: unknown) {
  return asText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function uniqueEmails(values: unknown[]) {
  const seen = new Set<string>();
  const emails: string[] = [];
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  values.flat().forEach((value) => {
    const email = asText(value).trim().toLowerCase();
    if (!email || !emailPattern.test(email) || blockedRecipientEmails.has(email) || seen.has(email)) return;
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

async function sendAutomaticAbsenceEmail(
  supabase: ReturnType<typeof createClient>,
  schedule: Record<string, unknown>,
  incidentId: number,
  emailSentAt: string,
) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const horarioId = asInt(recordValue(schedule, "id"));
  const scheduleStoreId = asInt(recordValue(schedule, "tienda_id"));
  const [promoterResult, storeResult, userResult] = await Promise.all([
    supabase
      .from(tablePromoters)
      .select("id,nombre_completo,Marca,Correo")
      .eq("id", recordValue(schedule, "impulsadora_id"))
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

  const promoter = promoterResult.data;
  const store = storeResult.data;
  const adminEmails = (userResult.data || []).map((user) => asText(recordValue(user, "email")));
  const recipients = uniqueEmails([adminEmails, recordValue(promoter, "Correo")]);

  if (!recipients.length) {
    console.warn(`No recipient emails found for automatic absence ${incidentId}`);
    return false;
  }

  const personName = asText(recordValue(promoter, "nombre_completo"), "No especificado");
  const brandName = asText(recordValue(promoter, "Marca"), "Sin marca");
  const storeName = asText(recordValue(store, "nombre_display"), "No especificada");
  const dateText = formatDate(recordValue(schedule, "fecha"));
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
          <h1>Falta automática generada</h1>
        </div>
        <div class="content">
          <div class="field">
            <div class="field-label" style="color: #f20356;">Tipo de Incidencia</div>
            <div class="field-value highlight">${escapeHtml(autoSubject)}</div>
          </div>
          <div class="field">
            <div class="field-label">Personal</div>
            <div class="field-value">${escapeHtml(personName)}</div>
          </div>
          <div class="field">
            <div class="field-label">Marca</div>
            <div class="field-value">${escapeHtml(brandName)}</div>
          </div>
          <div class="field">
            <div class="field-label">Fecha</div>
            <div class="field-value">${escapeHtml(dateText || "No especificada")}</div>
          </div>
          <div class="field">
            <div class="field-label">Tienda</div>
            <div class="field-value">${escapeHtml(storeName)}</div>
          </div>
          <div class="field observation">
            <div class="field-label">Observación</div>
            <div class="field-value">${escapeHtml(autoObservation)}</div>
          </div>
          <div class="field">
            <div class="field-label">Reportado por</div>
            <div class="field-value">Cierre automático de asistencia</div>
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

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Idempotency-Key": `auto-absence-${incidentId}`,
    },
    body: JSON.stringify({
      from: "StaffPlanner <notificaciones@elpeluquero.ec>",
      to: recipients,
      subject: `Falta automática - ${personName} - ${autoSubject}`,
      html: htmlContent,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || `Resend error: ${res.status}`);
  }

  const { error: sentError } = await supabase
    .from(tableAttendance)
    .update({ correo_falta_auto_enviado_en: emailSentAt, actualizado_en: emailSentAt })
    .eq("horario_id", horarioId)
    .eq("falta_id", incidentId)
    .is("correo_falta_auto_enviado_en", null);
  if (sentError) throw sentError;

  return true;
}

async function trySendAutomaticAbsenceEmail(
  supabase: ReturnType<typeof createClient>,
  schedule: Record<string, unknown>,
  incidentId: number,
  emailSentAt: string,
) {
  try {
    return await sendAutomaticAbsenceEmail(supabase, schedule, incidentId, emailSentAt);
  } catch (error) {
    console.error(`automatic absence email error for incident ${incidentId}:`, error);
    return false;
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
    let emailed = 0;
    let emailErrors = 0;
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
        if (!recordValue(existingAttendance, "correo_falta_auto_enviado_en")) {
          const incidentId = asInt(recordValue(existingAttendance, "falta_id"));
          if (incidentId) {
            const mailSent = await trySendAutomaticAbsenceEmail(supabase, schedule, incidentId, now);
            if (mailSent) {
              emailed += 1;
            } else {
              emailErrors += 1;
            }
          }
        }
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

      if (await trySendAutomaticAbsenceEmail(supabase, schedule, incidentId, now)) {
        emailed += 1;
      } else {
        emailErrors += 1;
      }
      generated += 1;
    }

    const responseBody = {
      success: true,
      fecha,
      total: scheduleRows.length,
      approved,
      generated,
      emailed,
      emailErrors,
      skipped,
    };

    if (emailErrors > 0) {
      return jsonResponse({
        ...responseBody,
        success: false,
        error: "Una o mas faltas automaticas quedaron sin correo enviado.",
      }, 500);
    }

    return jsonResponse(responseBody);
  } catch (error) {
    console.error("close-store-attendance error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
