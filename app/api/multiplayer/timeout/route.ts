import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUser } from "@/lib/server-auth";

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
    }

    const token = authorization.slice(7).trim();
    const { data: { user }, error: authError } = await getAuthenticatedUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Your session is invalid. Please log in again." }, { status: 401 });
    }

    const { gameId } = await request.json();
    if (typeof gameId !== "string" || !gameId.trim()) {
      return NextResponse.json({ error: "A valid game ID is required." }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
    }

    const admin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await admin.rpc("claim_game_timeout", {
      p_game_id: gameId,
      p_player_id: user.id,
    });

    if (error) {
      console.error("Timeout adjudication failed:", error.message);
      return NextResponse.json({ error: "Unable to verify the game clock." }, { status: 500 });
    }

    return NextResponse.json({ success: true, timedOut: Boolean(data) });
  } catch (error) {
    console.error("Timeout API error:", error);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
