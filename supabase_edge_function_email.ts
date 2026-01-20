// Supabase Edge Function: send-incidence-email
// VERSIÓN MEJORADA con debugging

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Log para debugging
    console.log("=== EMAIL FUNCTION CALLED ===");

    // Obtener API Key
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    console.log("API Key exists:", !!RESEND_API_KEY);

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    // Parsear body
    const body = await req.json();
    console.log("Body received:", JSON.stringify(body));

    const {
      incidenceType,
      observation,
      personName,
      dateStr,
      storeName,
      reportedBy,
      recipientEmails
    } = body;

    // Validar datos
    if (!recipientEmails || !Array.isArray(recipientEmails) || recipientEmails.length === 0) {
      throw new Error("recipientEmails is required and must be a non-empty array");
    }

    console.log("Sending to:", recipientEmails);

    // Mapear tipo de incidencia
    const tipoTexto: Record<string, string> = {
      'FALTA': '🚫 No se presentó (Falta)',
      'FALTA_INJUSTIFICADA': '🚫 Falta Injustificada',
      'FALTA_JUSTIFICADA': '✅ Falta Justificada',
      'TARDANZA': '⏰ Llegó tarde',
      'IMPUNTUALIDAD': '⏰ Impuntualidad',
      'SALIDA_TEMPRANA': '🏃 Salió antes de tiempo',
      'PRESENTACIÓN': '👔 Presentación',
      'ACTITUD': '😤 Actitud',
      'QUEJA_DE_CLIENTE': '😡 Queja de Cliente',
      'OTRO': '📋 Otro',
      'OTROS': '📋 Otros'
    };

    const tipoDisplay = tipoTexto[incidenceType] || incidenceType;

    // Formatear fecha a dd/mm/yyyy
    let formattedDate = dateStr;
    try {
      if (dateStr && dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          // Asume formato YYYY-MM-DD
          formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }
    } catch (e) {
      console.error("Error formatting date:", e);
    }

    // HTML del email
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f9f9f9; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
            .header { background-color: #000000; padding: 20px; text-align: center; border-bottom: 4px solid #f20356; }
            .header img { max-height: 60px; width: auto; }
            .header h1 { color: white; margin: 15px 0 0 0; font-size: 20px; font-weight: 500; }
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
              <img src="https://cectqtufttubsepyiolr.supabase.co/storage/v1/object/sign/Logo%20Peluquero/logo-novepsa-sf-blanco.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV80YWZhZjRlMy0yYzNlLTQyODktYTJmYS03MDA1NWY2ZDBmZjIiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJMb2dvIFBlbHVxdWVyby9sb2dvLW5vdmVwc2Etc2YtYmxhbmNvLnBuZyIsImlhdCI6MTc2ODg1MjE3MiwiZXhwIjoyMDg0MjEyMTcyfQ.d3hfEwfgPzwbLvqrWoFE3jYnqMmeuUzTWxHrfafW38A" alt="Novepsa Logo">
              <h1>⚠️ Nueva Incidencia Reportada</h1>
            </div>
            <div class="content">
              <div class="field">
                <div class="field-label" style="color: #f20356;">Tipo de Incidencia</div>
                <div class="field-value highlight">${tipoDisplay}</div>
              </div>
              <div class="field">
                <div class="field-label">Personal</div>
                <div class="field-value">${personName || 'No especificado'}</div>
              </div>
              <div class="field">
                <div class="field-label">Fecha</div>
                <div class="field-value">${formattedDate || 'No especificada'}</div>
              </div>
              <div class="field">
                <div class="field-label">Tienda</div>
                <div class="field-value">${storeName || 'No especificada'}</div>
              </div>
              <div class="field observation">
                <div class="field-label">Observación</div>
                <div class="field-value">${observation || 'Sin observación'}</div>
              </div>
              <div class="field">
                <div class="field-label">Reportado por</div>
                <div class="field-value">${reportedBy || 'Sistema'}</div>
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

    // Llamar a Resend
    console.log("Calling Resend API...");

    const resendPayload = {
      from: "StaffPlanner <notificaciones@elpeluquero.ec>",
      to: recipientEmails,
      subject: `⚠️ Incidencia - ${personName || 'Personal'} - ${tipoDisplay}`,
      html: htmlContent,
    };

    console.log("Resend payload:", JSON.stringify(resendPayload));

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(resendPayload),
    });

    const data = await res.json();
    console.log("Resend response status:", res.status);
    console.log("Resend response:", JSON.stringify(data));

    if (!res.ok) {
      console.error("Resend error:", data);
      throw new Error(data.message || `Resend error: ${res.status}`);
    }

    console.log("Email sent successfully!");

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Function error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
