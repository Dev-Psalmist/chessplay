import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Chess } from "chess.js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
    const { gameId, from, to, promotion } = body ?? {};

    if (
      typeof gameId !== "string" ||
      typeof from !== "string" ||
      typeof to !== "string"
    ) {
      return errorResponse("Invalid move request.");
    }

    if (
      !/^[a-h][1-8]$/.test(from) ||
      !/^[a-h][1-8]$/.test(to)
    ) {
      return errorResponse("Invalid chess squares.");
    }

    if (
      promotion !== undefined &&
      promotion !== null &&
      !["q", "r", "b", "n"].includes(promotion)
    ) {
      return errorResponse("Invalid promotion piece.");
    }

    const supabase = getAdminClient();

    // Verify the player's authentication.
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      console.error("Authentication error:", authError);

      return errorResponse(
        "Your session is invalid. Please log in again.",
        401
      );
    }

    // Retrieve the requested game.
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select(
        "id, white_player_id, black_player_id, status, current_fen, pgn"
      )
      .eq("id", gameId)
      .maybeSingle();

    if (gameError) {
      console.error("Game database query failed:", {
        gameId,
        code: gameError.code,
        message: gameError.message,
        details: gameError.details,
        hint: gameError.hint,
      });

      const message =
        process.env.NODE_ENV === "development"
          ? `Database error loading game: ${gameError.message}`
          : "Unable to retrieve this game.";

      return errorResponse(message, 500);
    }

    if (!game) {
      console.error("Game record not found:", gameId);

      return errorResponse(
        "No game record matches this game ID. Return to the lobby and create or join a game again.",
        404
      );
    }

    if (game.status !== "active") {
      return errorResponse("This game is not active.");
    }

    const isWhite = game.white_player_id === user.id;
    const isBlack = game.black_player_id === user.id;

    if (!isWhite && !isBlack) {
      return errorResponse(
        "You are not a player in this game.",
        403
      );
    }

    // Retrieve previous moves.
    const { data: previousMoves, error: movesError } = await supabase
      .from("game_moves")
      .select("from_square, to_square, promotion")
      .eq("game_id", gameId)
      .order("ply", { ascending: true });

    if (movesError) {
      console.error("Move history query failed:", movesError);

      return errorResponse(
        "Could not load the game history.",
        500
      );
    }

    // Reconstruct the chess position.
    const chess = new Chess();

    for (const previousMove of previousMoves ?? []) {
      try {
        chess.move({
          from: previousMove.from_square,
          to: previousMove.to_square,
          ...(previousMove.promotion
            ? { promotion: previousMove.promotion }
            : {}),
        });
      } catch {
        return errorResponse(
          "The saved game history is inconsistent.",
          409
        );
      }
    }

    // Check that the reconstructed position matches the database.
    if (chess.fen() !== game.current_fen) {
      return errorResponse(
        "The board is out of sync. Refresh the game and try again.",
        409
      );
    }

    // Check whose turn it is.
    const expectedColor = isWhite ? "w" : "b";

    if (chess.turn() !== expectedColor) {
      return errorResponse("It is not your turn.");
    }

    // Validate the requested move.
    let playedMove;

    try {
      playedMove = chess.move({
        from,
        to,
        ...(promotion ? { promotion } : {}),
      });
    } catch {
      return errorResponse("That is not a legal chess move.");
    }

    if (!playedMove) {
      return errorResponse("That is not a legal chess move.");
    }

    const newFen = chess.fen();
    const newPgn = chess.pgn();
    const ply = (previousMoves?.length ?? 0) + 1;

    let result: string | null = null;
    let winnerId: string | null = null;

    if (chess.isCheckmate()) {
      winnerId =
        chess.turn() === "w"
          ? game.black_player_id
          : game.white_player_id;

      result =
        winnerId === game.white_player_id
          ? "white_win"
          : "black_win";
    } else if (chess.isDraw()) {
      result = "draw";
    }

    // Commit the move atomically through the protected database function.
    const { error: saveError } = await supabase.rpc(
      "commit_chess_move",
      {
        p_game_id: gameId,
        p_player_id: user.id,
        p_expected_fen: game.current_fen,
        p_from_square: from,
        p_to_square: to,
        p_promotion: promotion ?? null,
        p_san: playedMove.san,
        p_fen_after: newFen,
        p_pgn: newPgn,
        p_ply: ply,
        p_result: result,
        p_winner_id: winnerId,
      }
    );

    if (saveError) {
      console.error("Move commit failed:", saveError);

      return errorResponse(saveError.message, 409);
    }

    return NextResponse.json({
      success: true,
      move: playedMove.san,
      fen: newFen,
      pgn: newPgn,
      result,
      winnerId,
    });

  } catch (error) {
    console.error("Multiplayer move API error:", error);

    return errorResponse(
      "An unexpected server error occurred.",
      500
    );
  }
}