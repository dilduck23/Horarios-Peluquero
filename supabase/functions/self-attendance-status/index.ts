import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-horarios-attendance-secret",
};

const tableAttendance = "Tiendas_Asistencia";
const tableSchedule = "Tiendas_Horario";
const tablePromoters = "Tiendas_Impulsadoras";
const tablePersonal = "Tiendas_Personal";
const tablePersonalSchedule = "Tiendas_Personal_Horario";
const tableIncidents = "Tiendas_Faltas";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const parsed = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text ? text : "";
}

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeBase64url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", textEncoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, textEncoder.encode(value)));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function bridgeAuthorized(req: Request) {
  const expected = Deno.env.get("HORARIOS_ATTENDANCE_BRIDGE_SECRET") || "";
  const received = req.headers.get("x-horarios-attendance-secret") || "";
  if (expected.length < 32 || !received || received.length > 512) return false;
  return constantTimeEqual(await hmac("bridge", expected), await hmac("bridge", received));
}

async function signStaffSession(personId: number, kind: "staff" | "personal", secret: string) {
  const payload = base64url(textEncoder.encode(JSON.stringify({ id: personId, kind, exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60 })));
  return `${payload}.${base64url(await hmac(payload, secret))}`;
}

async function verifyStaffSession(token: unknown, secret: string) {
  if (typeof token !== "string" || token.length > 2048) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  try {
    const receivedSignature = decodeBase64url(parts[1]);
    const expectedSignature = await hmac(parts[0], secret);
    if (!constantTimeEqual(receivedSignature, expectedSignature)) return null;
    const payload = JSON.parse(textDecoder.decode(decodeBase64url(parts[0]))) as Record<string, unknown>;
    const id = Number(payload.id);
    const exp = Number(payload.exp);
    const kind = payload.kind;
    if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(exp)
      || exp <= Math.floor(Date.now() / 1000) || (kind !== "staff" && kind !== "personal")) return null;
    return { id, exp, kind } as { id: number; exp: number; kind: "staff" | "personal" };
  } catch {
    return null;
  }
}

async function scheduleForPinSession(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
) {
  const secret = Deno.env.get("HORARIOS_STAFF_SESSION_SECRET") || "";
  if (secret.length < 32) return jsonResponse({ error: "Autenticación de PIN no configurada" }, 503);
  const session = await verifyStaffSession(body.sessionToken, secret);
  if (!session) return jsonResponse({ error: "Sesión vencida o no válida" }, 401);

  const from = validDateKey(body.from);
  const to = validDateKey(body.to);
  if (!from || !to || from > to
    || (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) > 93 * 86400000) {
    return jsonResponse({ error: "Rango de fechas no válido" }, 400);
  }

  if (session.kind === "personal") {
    const [{ data: profile, error: profileError }, { data: schedules, error: scheduleError }] = await Promise.all([
      supabase.from(tablePersonal)
        .select("id,nombre_completo,idvendedor,idbodega,habilitado")
        .eq("id", session.id).maybeSingle(),
      supabase.from(tablePersonalSchedule)
        .select("id,personal_id,fecha,tienda_id,tipo,nota,creado_en")
        .eq("personal_id", session.id).gte("fecha", from).lte("fecha", to).order("fecha"),
    ]);
    if (profileError) throw profileError;
    if (scheduleError) throw scheduleError;
    if (!profile || profile.habilitado === false) return jsonResponse({ error: "Personal no disponible" }, 403);
    return jsonResponse({ success: true, kind: session.kind, profile, schedules: schedules || [] });
  }

  const [{ data: profile, error: profileError }, { data: schedules, error: scheduleError }] = await Promise.all([
    supabase.from(tablePromoters)
      .select("id,nombre_completo,Marca,idCategoria,Habilitado")
      .eq("id", session.id).maybeSingle(),
    supabase.from(tableSchedule)
      .select("id,fecha,tienda_id,impulsadora_id,categoria_asignada_id,creado_en")
      .eq("impulsadora_id", session.id).gte("fecha", from).lte("fecha", to).order("fecha"),
  ]);
  if (profileError) throw profileError;
  if (scheduleError) throw scheduleError;
  if (!profile || profile.Habilitado === false) return jsonResponse({ error: "Impulsadora no disponible" }, 403);
  return jsonResponse({ success: true, kind: session.kind, profile, schedules: schedules || [] });
}

async function loginWithPin(supabase: ReturnType<typeof createClient>, req: Request, pin: unknown) {
  const secret = Deno.env.get("HORARIOS_STAFF_SESSION_SECRET") || "";
  if (secret.length < 32) return jsonResponse({ error: "Autenticación de PIN no configurada" }, 503);
  const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown").trim().slice(0, 100);
  const ipKey = Array.from(await hmac(`pin-ip:${ip}`, secret), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const globalKey = Array.from(await hmac("pin-global", secret), (byte) => byte.toString(16).padStart(2, "0")).join("");
  for (const [key, limit] of [[ipKey, 5], [globalKey, 100]] as const) {
    const { data: allowed, error } = await supabase.rpc("staffplanner_pin_login_attempt", { p_key_hash: key, p_max_attempts: limit });
    if (error) throw error;
    if (!allowed) return jsonResponse({ error: "Demasiados intentos. Espera 15 minutos." }, 429);
  }
  if (typeof pin !== "string" || !/^\d{4}$/.test(pin)) return jsonResponse({ error: "PIN inválido" }, 401);

  const { data: promoter, error: promoterError } = await supabase.from(tablePromoters)
    .select("*").eq("pin", pin).limit(1).maybeSingle();
  if (promoterError) throw promoterError;
  const { data: personal, error: personalError } = promoter ? { data: null, error: null } : await supabase.from(tablePersonal)
    .select("*").eq("pin", pin).limit(1).maybeSingle();
  if (personalError) throw personalError;
  const person = promoter || personal;
  if (!person || person.Habilitado === false || person.habilitado === false) return jsonResponse({ error: "PIN inválido" }, 401);
  const kind = promoter ? "staff" : "personal";
  return jsonResponse({ success: true, person: { id: person.id, nombre_completo: person.nombre_completo, kind },
    sessionToken: await signStaffSession(asInt(person.id), kind, secret) });
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

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return jsonResponse({ error: "JSON inválido" }, 400);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    if (body.action === "login") return await loginWithPin(supabase, req, body.pin);
    if (body.action === "schedule") return await scheduleForPinSession(supabase, body);
    if (!(await bridgeAuthorized(req))) return jsonResponse({ error: "No autorizado" }, 401);

    const impulsadoraId = Number(body?.impulsadoraId);
    const from = validDateKey(body?.from);
    const to = validDateKey(body?.to);
    if (!Number.isSafeInteger(impulsadoraId) || impulsadoraId <= 0 || !from || !to || from > to
      || (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) > 93 * 86400000) {
      return jsonResponse({ error: "Impulsadora o rango de fechas no válido" }, 400);
    }
    const { data: schedules, error: scheduleError } = await supabase
      .from(tableSchedule)
      .select("id")
      .eq("impulsadora_id", impulsadoraId)
      .gte("fecha", from)
      .lte("fecha", to);
    if (scheduleError) throw scheduleError;

    const scheduleIds = (schedules || []).map((row) => asInt(row.id)).filter(Boolean);
    if (!scheduleIds.length) return jsonResponse({ success: true, attendance: [], incidents: [] });

    const [{ data: attendance, error: attendanceError }, { data: incidents, error: incidentsError }] = await Promise.all([
      supabase.from(tableAttendance).select("horario_id,estado,aprobado_en,cerrado_en").in("horario_id", scheduleIds),
      supabase.from(tableIncidents).select("id,id_horario,asunto,observacion,creado_en").in("id_horario", scheduleIds).order("creado_en", { ascending: false }).limit(500),
    ]);
    if (attendanceError) throw attendanceError;
    if (incidentsError) throw incidentsError;

    return jsonResponse({ success: true, attendance: attendance || [], incidents: incidents || [] });
  } catch (error) {
    console.error("self-attendance-status error:", error);
    return jsonResponse({ error: "No se pudo consultar la asistencia" }, 500);
  }
});
