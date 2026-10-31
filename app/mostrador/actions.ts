"use server";

import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { readServerEnv } from "@/lib/env";
import { normalizePhone } from "@/lib/phone";
import { localToUtc } from "@/lib/time";
import { generateToken, hashToken, phoneHmac } from "@/lib/tokens";
import { ratingMessage, ratingUrl, whatsappLink } from "@/lib/whatsapp";

export type FormState = { error?: string; ok?: string };
export type SendState =
  | { error: string }
  | { kind: "whatsapp"; href: string }
  | { kind: "qr"; svg: string }
  | null;

const GENERIC_ERROR = "Algo salió mal. Probá de nuevo.";

// Los mensajes que levanta la base ya están en español; el resto se generaliza.
function dbError(error: { code?: string; message: string }): string {
  const ours = ["P0002", "23502", "22023", "23514"].includes(error.code ?? "");
  if (ours && !error.message.includes("violates")) return error.message;
  if (error.code === "23503") return "El barbero no trabaja en ese local.";
  if (error.code === "42501") return "No tenés permiso para hacer eso.";
  return GENERIC_ERROR;
}

const uuid = z.uuid();

// Valida que el local sea uno de los de este usuario de recepción.
async function staffAt(locationId: FormDataEntryValue | null) {
  const ctx = await requireStaff();
  const location = ctx.locations.find((l) => l.id === locationId);
  if (!location) throw new Error("Local no asignado a este usuario");
  return { ...ctx, location };
}

export async function createAppointment(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, location } = await staffAt(formData.get("location_id"));
  const env = readServerEnv(process.env);

  const barberId = uuid.safeParse(formData.get("barber_id"));
  if (!barberId.success) return { error: "Elegí un barbero." };

  const scheduledAt = localToUtc(String(formData.get("scheduled_at") ?? ""), location.timezone);
  if (!scheduledAt) return { error: "Revisá la fecha y la hora." };

  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  if (!phone) return { error: "Ese teléfono no parece válido. Ejemplo: 11 5555-5555." };

  const { error } = await supabase.rpc("create_appointment", {
    p_location_id: location.id,
    p_barber_id: barberId.data,
    p_scheduled_at: scheduledAt.toISOString(),
    p_phone_e164: phone,
    p_phone_hmac: phoneHmac(phone, env.phoneHmacSecret),
    p_walk_in: false,
  });
  if (error) return { error: dbError(error) };

  revalidatePath("/mostrador");
  return { ok: "Turno cargado." };
}

export async function setStatus(formData: FormData): Promise<void> {
  const { supabase } = await requireStaff();
  const id = uuid.parse(formData.get("appointment_id"));
  const status = z.enum(["completed", "cancelled"]).parse(formData.get("status"));
  await supabase
    .from("appointments")
    .update({ status, completed_at: status === "completed" ? new Date().toISOString() : null })
    .eq("id", id);
  revalidatePath("/mostrador");
}

// Genera el token, guarda su hash y devuelve el link de WhatsApp o el QR.
async function issue(
  supabase: Awaited<ReturnType<typeof requireStaff>>["supabase"],
  appointmentId: string,
  channel: "whatsapp" | "qr",
): Promise<SendState> {
  const env = readServerEnv(process.env);
  const token = generateToken();
  const { error } = await supabase.rpc("issue_rating_token", {
    p_appointment_id: appointmentId,
    p_token_hash: hashToken(token),
    p_channel: channel,
  });
  if (error) return { error: dbError(error) };

  if (channel === "qr") {
    const svg = await QRCode.toString(ratingUrl(env.appUrl, token), { type: "svg", margin: 1 });
    return { kind: "qr", svg };
  }

  const { data: appt } = await supabase
    .from("appointments")
    .select("location_id")
    .eq("id", appointmentId)
    .single();
  const { data: contact } = await supabase
    .from("appointment_contacts")
    .select("phone_e164")
    .eq("appointment_id", appointmentId)
    .maybeSingle();
  if (!appt || !contact) return { error: "Este turno no tiene teléfono. Usá el QR." };

  const { data: location } = await supabase
    .from("locations")
    .select("name")
    .eq("id", appt.location_id)
    .single();
  const text = ratingMessage(location?.name ?? "la barbería", env.appUrl, token);
  return { kind: "whatsapp", href: whatsappLink(contact.phone_e164, text) };
}

export async function sendRating(_: SendState, formData: FormData): Promise<SendState> {
  const { supabase } = await requireStaff();
  const id = uuid.safeParse(formData.get("appointment_id"));
  if (!id.success) return { error: GENERIC_ERROR };
  const channel = formData.get("channel") === "qr" ? "qr" : "whatsapp";
  return issue(supabase, id.data, channel);
}

// Walk-in: turno ya completado y QR en pantalla. El teléfono es opcional.
export async function createWalkIn(_: SendState, formData: FormData): Promise<SendState> {
  const { supabase, location } = await staffAt(formData.get("location_id"));
  const env = readServerEnv(process.env);

  const barberId = uuid.safeParse(formData.get("barber_id"));
  if (!barberId.success) return { error: "Elegí un barbero." };

  const rawPhone = String(formData.get("phone") ?? "").trim();
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (rawPhone && !phone) return { error: "Ese teléfono no parece válido. Podés dejarlo vacío." };

  const { data: appointmentId, error } = await supabase.rpc("create_appointment", {
    p_location_id: location.id,
    p_barber_id: barberId.data,
    p_scheduled_at: new Date().toISOString(),
    p_phone_e164: phone,
    p_phone_hmac: phone ? phoneHmac(phone, env.phoneHmacSecret) : null,
    p_walk_in: true,
  });
  if (error) return { error: dbError(error) };

  revalidatePath("/mostrador");
  return issue(supabase, appointmentId as string, "qr");
}
