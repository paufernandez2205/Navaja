import { NextResponse, type NextRequest } from "next/server";
import { submitRating } from "@/lib/rating";
import { createAnonClient } from "@/lib/supabase/anon";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const supabase = createAnonClient();
  const result = await submitRating((fn, args) => supabase.rpc(fn, args), body);
  return NextResponse.json(result.body, { status: result.status });
}
