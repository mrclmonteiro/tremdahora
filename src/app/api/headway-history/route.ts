import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("headway_history")
    .select("recorded_at, headway_nh, headway_mr")
    .gte("recorded_at", since)
    .order("recorded_at", { ascending: true });

  if (error) return NextResponse.json([], { status: 500 });
  return NextResponse.json(data ?? []);
}