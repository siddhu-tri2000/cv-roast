import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/server";

export const revalidate = 60;

export async function GET() {
  try {
    const supabase = getAdminSupabase();
    const { data, error } = await supabase
      .from("public_stats")
      .select("searches_7d, searches_total, users_total")
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { searches_7d: 0, searches_total: 0, users_total: 0 },
      { status: 200 },
    );
  }
}
