import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const allowedActions = [
  "resign",
  "offer_draw",
  "accept_draw",
  "decline_draw",
] as const;

type GameAction = (typeof allowedActions)[number];

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return errorResponse("You must be logged in.", 401);
    }

    const accessToken = authorization.slice(7).trim();

    if (!accessToken) {
      return errorResponse("Missing access token.", 401);
    }

    const body = await request.json();
    const { gameId, action } = body ?? {};

    if (typeof gameId !== "string" || !gameId.trim()) {
      return errorResponse("A valid game ID is required.");
    }

    if (
      typeof action !== "string" ||
      !allowedActions.includes(action as GameAction)
    ) {
      return errorResponse("Invalid game action.");
    }

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase server environment variables.");
      return errorResponse("Server configuration error.", 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      return errorResponse(
        "Your session is invalid. Please log in again.",
        401
      );
    }

    const { error: actionError } = await supabase.rpc(
      "handle_chess_game_action",
      {
        p_game_id: gameId,
        p_player_id: user.id,
        p_action: action,
      }
    );

    if (actionError) {
      console.error("Game action failed:", {
        gameId,
        action,
        message: actionError.message,
        code: actionError.code,
      });

      return errorResponse(actionError.message, 409);
    }

    return NextResponse.json({
      success: true,
      action,
    });
  } catch (error) {
    console.error("Multiplayer action API error:", error);

    return errorResponse(
      "An unexpected server error occurred.",
      500
    );
  }
}