import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUser } from "@/lib/server-auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type RatingType = "bullet" | "blitz" | "rapid";
type Action = "find" | "cancel";

function respond(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return respond("You must be logged in.", 401);
    }

    const token = authorization.slice(7).trim();
    if (!token) return respond("Missing access token.", 401);

    const { data: { user }, error: authError } = await getAuthenticatedUser(token);
    if (authError || !user) return respond("Your session is invalid. Please log in again.", 401);

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Ranked matchmaking environment variables are missing.");
      return respond("Server configuration error.", 500);
    }

    const body = await request.json();
    const action = body?.action as Action;
    if (action !== "find" && action !== "cancel") {
      return respond("Invalid matchmaking action.");
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (action === "cancel") {
      const { error } = await admin.rpc("cancel_ranked_match", {
        p_player_id: user.id,
      });
      if (error) {
        console.error("Ranked queue cancellation failed:", error.message);
        return respond("Unable to leave the matchmaking queue.", 500);
      }
      return NextResponse.json({ success: true, cancelled: true });
    }

    const ratingType = body?.ratingType as RatingType;
    const timeControl = String(body?.timeControl ?? "");

    if (!["bullet", "blitz", "rapid"].includes(ratingType)) {
      return respond("Choose a valid ranked format.");
    }

    const allowedControls: Record<RatingType, string[]> = {
      bullet: ["1"],
      blitz: ["3", "5"],
      rapid: ["10", "15"],
    };

    if (!allowedControls[ratingType].includes(timeControl)) {
      return respond("That time control does not belong to the selected rating pool.");
    }

    const { data, error } = await admin.rpc("find_ranked_match", {
      p_player_id: user.id,
      p_rating_type: ratingType,
      p_time_control: timeControl,
    });

    if (error) {
      console.error("Ranked matchmaking failed:", error.message);
      return respond(error.message || "Unable to find a ranked opponent.", 500);
    }

    const result = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({
      success: true,
      matched: Boolean(result?.is_matched && result?.matched_game_id),
      gameId: result?.matched_game_id ?? null,
    });
  } catch (error) {
    console.error("Ranked matchmaking API error:", error);
    return respond("An unexpected matchmaking error occurred.", 500);
  }
}
