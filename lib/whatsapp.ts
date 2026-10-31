export function ratingUrl(appUrl: string, token: string): string {
  return new URL(`/r/${token}`, appUrl).toString();
}

// Incluye el aviso de privacidad que exige la Ley 25.326 (artículo 6).
export function ratingMessage(locationName: string, appUrl: string, token: string): string {
  const privacy = new URL("/privacidad", appUrl).toString();
  return [
    `¡Gracias por venir a ${locationName}! ¿Cómo te atendieron?`,
    `Calificá tu corte en 10 segundos: ${ratingUrl(appUrl, token)}`,
    "",
    `Usamos tu número solo para enviarte este link y medir la atención. Más info: ${privacy}`,
  ].join("\n");
}

// Link que abre WhatsApp con el mensaje ya escrito. Sin API: lo envía quien
// está en el mostrador desde su propio WhatsApp.
export function whatsappLink(phoneE164: string, text: string): string {
  return `https://wa.me/${phoneE164.replace(/^\+/, "")}?text=${encodeURIComponent(text)}`;
}
