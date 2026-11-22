import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { createClient } from "@supabase/supabase-js";


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase server environment variables are missing.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;

    if (!token) {
      return NextResponse.json(
        { error: "You must be logged in." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, gameId, requestId } = body;

    const admin = getAdminClient();

    const {
      data: { user },
      error: authError,
    } = await getAuthenticatedUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Your session is invalid. Please log in again." },
        { status: 401 }
      );
    }

    if (action === "request") {
      if (!gameId) {
        return NextResponse.json(
          { error: "A game ID is required." },
          { status: 400 }
        );
      }

      const { data, error } = await admin.rpc(
        "request_chess_rematch",
        {
          p_game_id: gameId,
          p_player_id: user.id,
        }
      );

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        requestId: data,
        message: "Rematch request sent.",
      });
    }

    if (action === "accept" || action === "decline") {
      if (!requestId) {
        return NextResponse.json(
          { error: "A rematch request ID is required." },
          { status: 400 }
        );
      }

      const { data, error } = await admin.rpc(
        "respond_chess_rematch",
        {
          p_request_id: requestId,
          p_player_id: user.id,
          p_decision: action,
        }
      );

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        newGameId: data,
        message:
          action === "accept"
            ? "Rematch accepted."
            : "Rematch declined.",
      });
    }

    return NextResponse.json(
      { error: "Invalid rematch action." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Rematch API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong.",
      },
      { status: 500 }
    );
  }
}
