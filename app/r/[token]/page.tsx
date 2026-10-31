import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAnonClient } from "@/lib/supabase/anon";
import { hashToken } from "@/lib/tokens";
import { RatingForm } from "./rating-form";

export const metadata: Metadata = {
  title: "Calificá tu corte",
  robots: { index: false, follow: false },
  // El token va en la dirección: que no viaje a otros sitios.
  referrer: "no-referrer",
};

type Context = {
  location_name: string;
  barber_name: string;
  barber_photo_url: string | null;
  has_google_review: boolean;
};

export default async function RatePage({ params }: PageProps<"/r/[token]">) {
  const { token } = await params;
  const { data } = await createAnonClient().rpc("get_rating_context", {
    p_token_hash: hashToken(token),
  });
  const ctx = (data as Context[] | null)?.[0];
  if (!ctx) notFound();

  return (
    <RatingForm
      token={token}
      locationName={ctx.location_name}
      barberName={ctx.barber_name}
      barberPhotoUrl={ctx.barber_photo_url}
      hasGoogleReview={ctx.has_google_review}
    />
  );
}
