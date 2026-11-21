"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { initSounds, playSound } from "@/lib/sound";
import ChessClock from "@/components/ChessClock";
import {
  boardFrameStyle,
  darkNotationStyle,
  darkSquareStyle,
  draggingPieceGhostStyle,
  draggingPieceStyle,
  dropSquareStyle,
  lightNotationStyle,
  lightSquareStyle,
  squareHighlights,
} from "@/lib/board-theme";
import { supabase } from "@/lib/supabase";

type Game = {
  id: string;
  white_player_id: string;
  black_player_id: string | null;
  status: string;
  current_fen: string;
  pgn: string | null;
  result: string | null;
  winner_id: string | null;
  draw_offer_by: string | null;
};

type Move = {
  id: string;
  ply: number;
  san: string;
  player_id: string;
};

type ChatMessage = {
  id: string;
  game_id: string;
  sender_id: string;
  message: string;
  created_at: string;
};

type RematchRequest = {
  id: string;
  original_game_id: string;
  requester_id: string;
  opponent_id: string;
  status: "pending" | "accepted" | "declined";
  new_game_id: string | null;
  created_at: string;
};

type GameAction =
  | "resign"
  | "offer_draw"
  | "accept_draw"
  | "decline_draw";

type RematchAction = "request" | "accept" | "decline";

function MultiplayerMatchContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const gameId = params.id;

  const [userId, setUserId] = useState("");
  const [game, setGame] = useState<Game | null>(null);
  const [clock, setClock] = useState<{ white: number; black: number; daily: boolean } | null>(null);
  const clockTickRef = useRef<number | null>(null);
  const seenFenRef = useRef<string | null>(null);

  useEffect(() => {
    initSounds();
  }, []);

  useEffect(() => {
    const fen = game?.current_fen;

    if (!fen) return;

    if (seenFenRef.current === null) {
      seenFenRef.current = fen;
      return;
    }

    if (seenFenRef.current === fen) return;

    seenFenRef.current = fen;

    try {
      const probe = new Chess(fen);
      const last = probe.history({ verbose: true }).slice(-1)[0];

      if (!last) return;

      if (last.promotion) playSound("promote");
      else if (last.flags.includes("k") || last.flags.includes("q")) playSound("castle");
      else if (last.captured) playSound("capture");
      else playSound("move");

      if (probe.isGameOver()) window.setTimeout(() => playSound("game-end"), 200);
      else if (probe.isCheck()) window.setTimeout(() => playSound("check"), 140);
    } catch {
      /* a malformed fen should never break the board */
    }
  }, [game?.current_fen]);
  const lastMoveSquares = useMemo(() => {
    if (!game?.current_fen) return [] as string[];

    try {
      const probe = new Chess(game.current_fen);
      const last = probe.history({ verbose: true }).slice(-1)[0];
      return last ? [last.from, last.to] : [];
    } catch {
      return [] as string[];
    }
  }, [game?.current_fen]);

  const checkedKing = useMemo(() => {
    if (!game?.current_fen) return undefined;

    try {
      const probe = new Chess(game.current_fen);

      if (!probe.isCheck()) return undefined;

      for (const row of probe.board()) {
        for (const cell of row) {
          if (cell && cell.type === "k" && cell.color === probe.turn()) {
            return cell.square;
          }
        }
      }
    } catch {
      return undefined;
    }

    return undefined;
  }, [game?.current_fen]);
  const [moves, setMoves] = useState<Move[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [rematchRequest, setRematchRequest] =
    useState<RematchRequest | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [rematchBusy, setRematchBusy] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);

  const [error, setError] = useState("");
  const [rematchMessage, setRematchMessage] = useState("");
  const [chatError, setChatError] = useState("");

  const navigatingRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const isWhite = game?.white_player_id === userId;
  const orientation = isWhite ? "white" : "black";

  const isMyTurn = game
    ? (isWhite && game.current_fen.split(" ")[1] === "w") ||
      (!isWhite && game.current_fen.split(" ")[1] === "b")
    : false;

  const refreshGame = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const user = session?.user;

    if (!user) {
      router.push("/login");
      return;
    }

    setUserId(user.id);

    const { data: gameData, error: gameError } = await supabase
      .from("games")
      .select(
        "id, white_player_id, black_player_id, status, current_fen, pgn, result, winner_id, draw_offer_by"
      )
      .eq("id", gameId)
      .maybeSingle();

    if (gameError || !gameData) {
      setError("We couldn't find this game.");
      setLoading(false);
      return;
    }

    if (
      gameData.white_player_id !== user.id &&
      gameData.black_player_id !== user.id
    ) {
      setError("You are not a participant in this game.");
      setLoading(false);
      return;
    }

    setGame(gameData as Game);

    const { data: clockData, error: clockError } = await supabase
      .from("games")
      .select("time_control, white_time_ms, black_time_ms")
      .eq("id", gameId)
      .maybeSingle();

    if (!clockError && clockData && typeof clockData.white_time_ms === "number") {
      setClock({
        white: clockData.white_time_ms,
        black: clockData.black_time_ms ?? clockData.white_time_ms,
        daily: String(clockData.time_control ?? "").endsWith("d"),
      });
    }

    const { data: moveData, error: moveError } = await supabase
      .from("game_moves")
      .select("id, ply, san, player_id")
      .eq("game_id", gameId)
      .order("ply", { ascending: true });

    if (moveError) {
      setError("Could not load the move history.");
    } else {
      setMoves((moveData ?? []) as Move[]);
    }

    setLoading(false);
  }, [gameId, router]);

  const refreshChat = useCallback(async () => {
    const { data, error: chatLoadError } = await supabase
      .from("game_chat_messages")
      .select("id, game_id, sender_id, message, created_at")
      .eq("game_id", gameId)
      .order("created_at", { ascending: true })
      .limit(100);

    if (chatLoadError) {
      console.error("Could not load game chat:", chatLoadError.message);
      return;
    }

    setChatMessages((data ?? []) as ChatMessage[]);
  }, [gameId]);

  const refreshRematch = useCallback(async () => {
    const { data, error: rematchError } = await supabase
      .from("rematch_requests")
      .select(
        "id, original_game_id, requester_id, opponent_id, status, new_game_id, created_at"
      )
      .eq("original_game_id", gameId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!rematchError) {
      setRematchRequest(data as RematchRequest | null);
    }
  }, [gameId]);

  useEffect(() => {
    void refreshGame();
    void refreshRematch();
    void refreshChat();
  }, [refreshGame, refreshRematch, refreshChat]);

  useEffect(() => {
    if (!clock || !game || game.status !== "active") {
      clockTickRef.current = null;
      return;
    }

    const interval = window.setInterval(() => {
      const now = performance.now();
      const last = clockTickRef.current ?? now;
      clockTickRef.current = now;
      const delta = now - last;
      const turn = game.current_fen.split(" ")[1] === "w" ? "white" : "black";

      setClock((prev) => {
        if (!prev) return prev;
        const next = Math.max(0, prev[turn] - delta);
        return { ...prev, [turn]: next };
      });
    }, 500);

    return () => window.clearInterval(interval);
  }, [clock, game]);

  // Listen for game moves, game updates, rematch updates and chat messages.
  useEffect(() => {
    const channel = supabase
      .channel(`multiplayer-game-${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          const row = payload.new as Partial<Game> | null;

          if (row && typeof row.current_fen === "string") {
            setGame((prev) => (prev ? { ...prev, ...row } : prev));
          } else {
            void refreshGame();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_moves",
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          const row = payload.new as Move | null;

          if (row?.id) {
            setMoves((prev) =>
              prev.some((move) => move.id === row.id) ? prev : [...prev, row]
            );
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rematch_requests",
          filter: `original_game_id=eq.${gameId}`,
        },
        () => {
          void refreshRematch();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_chat_messages",
          filter: `game_id=eq.${gameId}`,
        },
        () => {
          void refreshChat();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [gameId, refreshGame, refreshRematch, refreshChat]);

  // Automatically scroll to the latest chat message.
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [chatMessages]);

  // Both players automatically enter the accepted rematch.
  useEffect(() => {
    if (
      rematchRequest?.status === "accepted" &&
      rematchRequest.new_game_id &&
      !navigatingRef.current
    ) {
      navigatingRef.current = true;
      router.push(`/multiplayer/${rematchRequest.new_game_id}`);
    }
  }, [rematchRequest, router]);

  const makeMove = async (
    from: string,
    to: string,
    promotion?: string
  ) => {
    if (!game || busy || !isMyTurn || game.status !== "active") {
      return;
    }

    setBusy(true);
    setError("");

    const previousFen = game.current_fen;

    // Paint the move straight away so the board never waits on the network.
    try {
      const optimistic = new Chess(previousFen);
      const applied = optimistic.move({ from, to, promotion });

      if (applied) {
        setGame((prev) =>
          prev ? { ...prev, current_fen: optimistic.fen() } : prev
        );
      }
    } catch {
      // the server remains the source of truth; a bad move is rejected below
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Your session has expired. Please log in again.");
      }

      const response = await fetch("/api/multiplayer/move", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          gameId,
          from,
          to,
          promotion,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "The move could not be saved.");
      }

      void refreshGame();
    } catch (err) {
      setGame((prev) =>
        prev ? { ...prev, current_fen: previousFen } : prev
      );

      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );

      void refreshGame();
    } finally {
      setBusy(false);
    }
  };

  const handleGameAction = async (action: GameAction) => {
    if (!game || actionBusy || game.status !== "active") {
      return;
    }

    if (
      action === "resign" &&
      !window.confirm(
        "Are you sure you want to resign? Your opponent will win this game."
      )
    ) {
      return;
    }

    setActionBusy(true);
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Your session has expired. Please log in again.");
      }

      const response = await fetch("/api/multiplayer/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          gameId,
          action,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "The game action failed.");
      }

      await refreshGame();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "The game action failed."
      );
    } finally {
      setActionBusy(false);
    }
  };

  const handleRematchAction = async (action: RematchAction) => {
    if (rematchBusy || !game) return;

    if (
      action === "request" &&
      !window.confirm(
        "Send your opponent a request to play another game?"
      )
    ) {
      return;
    }

    if (
      action === "accept" &&
      !window.confirm("Accept the rematch and start a new game?")
    ) {
      return;
    }

    setRematchBusy(true);
    setRematchMessage("");
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Your session has expired. Please log in again.");
      }

      const response = await fetch("/api/multiplayer/rematch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action,
          gameId,
          requestId: rematchRequest?.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "The rematch action failed.");
      }

      setRematchMessage(result.message || "Rematch updated.");

      if (action === "accept" && result.newGameId) {
        navigatingRef.current = true;
        router.push(`/multiplayer/${result.newGameId}`);
        return;
      }

      await refreshRematch();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "The rematch action failed."
      );
    } finally {
      setRematchBusy(false);
    }
  };

  const sendChatMessage = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const message = chatInput.trim();

    if (!message || !userId || !game || chatBusy) {
      return;
    }

    if (game.status !== "active") {
      setChatError("Chat is available while the game is in progress.");
      return;
    }

    if (message.length > 1000) {
      setChatError("Your message cannot exceed 1,000 characters.");
      return;
    }

    setChatBusy(true);
    setChatError("");

    try {
      const { error: insertError } = await supabase
        .from("game_chat_messages")
        .insert({
          game_id: gameId,
          sender_id: userId,
          message,
        });

      if (insertError) {
        throw new Error(insertError.message);
      }

      setChatInput("");
      await refreshChat();
    } catch (err) {
      setChatError(
        err instanceof Error
          ? err.message
          : "Your message could not be sent."
      );
    } finally {
      setChatBusy(false);
    }
  };

  const handlePieceDrop = ({
    sourceSquare,
    targetSquare,
  }: {
    sourceSquare: string;
    targetSquare: string | null;
  }) => {
    if (
      !game ||
      !targetSquare ||
      busy ||
      !isMyTurn ||
      game.status !== "active"
    ) {
      return false;
    }

    const chess = new Chess(game.current_fen);
    const movingPiece = chess.get(sourceSquare as never);

    let promotion: string | undefined;

    if (
      movingPiece?.type === "p" &&
      (targetSquare[1] === "1" || targetSquare[1] === "8")
    ) {
      promotion = "q";
    }

    void makeMove(sourceSquare, targetSquare, promotion);

    return false;
  };

  const resultText = () => {
    if (!game) return "";

    if (game.result === "draw") {
      return "The game ended in a draw.";
    }

    if (game.winner_id === userId) {
      return "Congratulations! You won!";
    }

    if (game.winner_id) {
      return "Your opponent won this game.";
    }

    return "Game completed.";
  };

  const formatChatTime = (date: string) => {
    return new Date(date).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-white">
        Loading your match...
      </main>
    );
  }

  if (error && !game) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--bg)] p-6 text-white">
        <p className="text-[color:var(--bad)]">{error}</p>

        <button
          onClick={() => router.push("/multiplayer")}
          className="rounded-xl bg-blue-600 px-5 py-3"
        >
          Back to Multiplayer
        </button>
      </main>
    );
  }

  if (!game) return null;

  const completed = game.status === "completed";
  const waiting = game.status === "waiting";

  const opponentOfferedDraw =
    Boolean(game.draw_offer_by) && game.draw_offer_by !== userId;

  const iOfferedDraw = game.draw_offer_by === userId;

  const iRequestedRematch =
    rematchRequest?.requester_id === userId;

  const opponentRequestedRematch =
    rematchRequest?.opponent_id === userId;

  const pendingRematch = rematchRequest?.status === "pending";

  return (
    <main className="min-h-screen bg-[var(--bg)] px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--accent-2)]">
              ChessPlay Online
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              Multiplayer Match
            </h1>

            <p className="mt-1 text-sm text-[color:var(--muted)]">
              Game ID: {game.id.slice(0, 8)}
            </p>
          </div>

          <button
            onClick={() => router.push("/multiplayer")}
            className="rounded-xl border border-[color:var(--line)] px-4 py-2 text-sm hover:bg-[var(--panel-2)]"
          >
            Back to Lobby
          </button>
        </header>

        {waiting ? (
          <section className="rounded-2xl border border-[color:var(--line)] bg-[var(--panel)] p-8 text-center">
            <h2 className="text-xl font-semibold">
              Waiting for your opponent
            </h2>

            <p className="mt-3 text-[color:var(--muted)]">
              Share your invitation code from the multiplayer lobby.
            </p>
          </section>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section>
              <div className="mb-4 flex items-center justify-between rounded-xl border border-[color:var(--line)] bg-[var(--panel)] p-4">
                <div>
                  <p className="text-xs uppercase text-[color:var(--muted)]">
                    You are playing as
                  </p>

                  <p className="mt-1 font-bold">
                    {isWhite ? "White" : "Black"}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs uppercase text-[color:var(--muted)]">
                    Match status
                  </p>

                  <p className="mt-1 font-semibold text-[color:var(--good)]">
                    {completed ? "Completed" : "Live"}
                  </p>
                </div>
              </div>

              {clock ? (
                <div className="mb-3">
                  <ChessClock
                    name={orientation === "white" ? "Black" : "White"}
                    detail="Opponent"
                    ms={orientation === "white" ? clock.black : clock.white}
                    daily={clock.daily}
                    active={
                      game.current_fen.split(" ")[1] ===
                      (orientation === "white" ? "b" : "w")
                    }
                  />
                </div>
              ) : null}

              <div className="overflow-hidden rounded-xl">
                <Chessboard
                  options={{
                    id: `multiplayer-${gameId}`,
                    position: game.current_fen,
                    boardOrientation: orientation,
                    onPieceDrop: handlePieceDrop,
                    allowDragging:
                      !completed && !waiting && isMyTurn && !busy,
                    animationDurationInMs: 160,
                    showNotation: true,
                    boardStyle: boardFrameStyle,
                    darkSquareStyle,
                    lightSquareStyle,
                    dropSquareStyle,
                    draggingPieceStyle,
                    draggingPieceGhostStyle,
                    darkSquareNotationStyle: darkNotationStyle,
                    lightSquareNotationStyle: lightNotationStyle,
                    squareStyles: squareHighlights({
                      lastMove: lastMoveSquares,
                      check: checkedKing,
                    }),
                  }}
                />
              </div>

              {clock ? (
                <div className="mt-3">
                  <ChessClock
                    name={orientation === "white" ? "White" : "Black"}
                    detail="You"
                    ms={orientation === "white" ? clock.white : clock.black}
                    daily={clock.daily}
                    active={
                      game.current_fen.split(" ")[1] ===
                      (orientation === "white" ? "w" : "b")
                    }
                  />
                </div>
              ) : null}

              <div className="mt-4 rounded-xl border border-[color:var(--line)] bg-[var(--panel)] p-4">
                {completed ? (
                  <p className="font-semibold text-[color:var(--good)]">
                    {resultText()}
                  </p>
                ) : busy ? (
                  <p className="text-[color:var(--accent-2)]">
                    Saving your move...
                  </p>
                ) : isMyTurn ? (
                  <p className="text-[color:var(--good)]">
                    Your turn. Make your move.
                  </p>
                ) : (
                  <p className="text-[color:var(--muted)]">
                    Waiting for your opponent to move...
                  </p>
                )}

                {error && (
                  <p className="mt-3 text-sm text-[color:var(--bad)]">
                    {error}
                  </p>
                )}
              </div>

              {/* DRAW AND RESIGN ACTIONS */}
              {!completed && (
                <section className="mt-6 rounded-2xl border border-[color:var(--line)] bg-[var(--panel)] p-5">
                  <h2 className="text-xl font-bold">
                    Game Actions
                  </h2>

                  <p className="mt-1 text-sm text-[color:var(--muted)]">
                    Manage your match or agree to a draw with your opponent.
                  </p>

                  {opponentOfferedDraw ? (
                    <div className="mt-4 rounded-xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 p-4">
                      <p className="font-semibold text-[color:var(--gold)]">
                        Your opponent has offered a draw.
                      </p>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          onClick={() => handleGameAction("accept_draw")}
                          disabled={actionBusy}
                          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50"
                        >
                          Accept Draw
                        </button>

                        <button
                          onClick={() => handleGameAction("decline_draw")}
                          disabled={actionBusy}
                          className="rounded-lg border border-[color:var(--line)] px-4 py-2 text-sm font-semibold hover:bg-[var(--panel-2)] disabled:opacity-50"
                        >
                          Decline Draw
                        </button>
                      </div>
                    </div>
                  ) : iOfferedDraw ? (
                    <p className="mt-4 rounded-xl bg-blue-500/10 p-4 text-sm text-[color:var(--accent-2)]">
                      Draw offer sent. Waiting for your opponent to respond.
                    </p>
                  ) : (
                    <button
                      onClick={() => handleGameAction("offer_draw")}
                      disabled={actionBusy}
                      className="mt-4 rounded-lg border border-blue-500 px-4 py-2 text-sm font-semibold text-[color:var(--accent-2)] hover:bg-blue-500/10 disabled:opacity-50"
                    >
                      Offer Draw
                    </button>
                  )}

                  <div className="mt-5 border-t border-[color:var(--line)] pt-5">
                    <button
                      onClick={() => handleGameAction("resign")}
                      disabled={actionBusy}
                      className="w-full rounded-lg bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                    >
                      {actionBusy ? "Processing..." : "Resign Game"}
                    </button>

                    <p className="mt-2 text-center text-xs text-[color:var(--muted)]">
                      Resigning immediately gives your opponent the win.
                    </p>
                  </div>
                </section>
              )}

              {/* REMATCH SECTION */}
              {completed && (
                <section className="mt-6 rounded-2xl border border-blue-500/30 bg-[var(--panel)] p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-2xl">
                      ♟
                    </div>

                    <div>
                      <h2 className="text-xl font-bold">
                        Rematch
                      </h2>

                      <p className="text-sm text-[color:var(--muted)]">
                        Ready for another game?
                      </p>
                    </div>
                  </div>

                  {pendingRematch && iRequestedRematch && (
                    <div className="mt-5 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
                      <p className="font-semibold text-[color:var(--accent-2)]">
                        Rematch request sent!
                      </p>

                      <p className="mt-2 text-sm text-[color:var(--muted)]">
                        Waiting for your opponent to accept.
                      </p>
                    </div>
                  )}

                  {pendingRematch && opponentRequestedRematch && (
                    <div className="mt-5 rounded-xl border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/10 p-4">
                      <p className="font-semibold text-[color:var(--gold)]">
                        Your opponent wants a rematch!
                      </p>

                      <p className="mt-2 text-sm text-[color:var(--muted)]">
                        Accept to start another game. Your colours will switch.
                      </p>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          onClick={() =>
                            handleRematchAction("accept")
                          }
                          disabled={rematchBusy}
                          className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {rematchBusy
                            ? "Processing..."
                            : "Accept Rematch"}
                        </button>

                        <button
                          onClick={() =>
                            handleRematchAction("decline")
                          }
                          disabled={rematchBusy}
                          className="rounded-lg border border-[color:var(--line)] px-5 py-3 text-sm font-semibold hover:bg-[var(--panel-2)] disabled:opacity-50"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  )}

                  {rematchRequest?.status === "declined" && (
                    <p className="mt-4 rounded-xl bg-[var(--panel-2)] p-4 text-sm text-[color:var(--muted)]">
                      The previous rematch request was declined. You can send another request.
                    </p>
                  )}

                  {rematchRequest?.status === "accepted" &&
                    rematchRequest.new_game_id && (
                      <p className="mt-4 rounded-xl bg-emerald-500/10 p-4 text-sm text-emerald-300">
                        Rematch accepted! Taking you to the new game...
                      </p>
                    )}

                  {(!rematchRequest ||
                    rematchRequest.status === "declined") && (
                    <button
                      onClick={() =>
                        handleRematchAction("request")
                      }
                      disabled={rematchBusy}
                      className="mt-5 w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                    >
                      {rematchBusy
                        ? "Sending request..."
                        : "Request Rematch"}
                    </button>
                  )}

                  {rematchMessage && (
                    <p className="mt-3 text-sm text-[color:var(--good)]">
                      {rematchMessage}
                    </p>
                  )}

                  {error && (
                    <p className="mt-3 text-sm text-[color:var(--bad)]">
                      {error}
                    </p>
                  )}

                  <p className="mt-4 text-center text-xs text-[color:var(--muted)]">
                    The next game starts with the colours reversed.
                  </p>
                </section>
              )}
            </section>

            {/* MOVE HISTORY, CHAT AND PLAYERS */}
            <aside className="space-y-6">
              {/* MOVE HISTORY */}
              <section className="rounded-2xl border border-[color:var(--line)] bg-[var(--panel)] p-5">
                <h2 className="text-xl font-bold">
                  Move History
                </h2>

                <p className="mt-1 text-sm text-[color:var(--muted)]">
                  Moves are synchronized between both players.
                </p>

                <div className="mt-5 max-h-[350px] overflow-y-auto">
                  {moves.length === 0 ? (
                    <p className="text-sm text-[color:var(--muted)]">
                      No moves have been played yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {Array.from(
                        { length: Math.ceil(moves.length / 2) },
                        (_, index) => {
                          const whiteMove = moves[index * 2];
                          const blackMove = moves[index * 2 + 1];

                          return (
                            <div
                              key={whiteMove.id}
                              className="grid grid-cols-[40px_1fr_1fr] gap-3 rounded-lg bg-[var(--panel-2)] p-3 text-sm"
                            >
                              <span className="text-[color:var(--muted)]">
                                {index + 1}.
                              </span>

                              <span>{whiteMove.san}</span>

                              <span>{blackMove?.san ?? "—"}</span>
                            </div>
                          );
                        }
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-6 border-t border-[color:var(--line)] pt-4">
                  <p className="text-xs uppercase tracking-wider text-[color:var(--muted)]">
                    Players
                  </p>

                  <p className="mt-3 text-sm">
                    ♔ White:{" "}
                    {game.white_player_id === userId
                      ? "You"
                      : "Opponent"}
                  </p>

                  <p className="mt-2 text-sm">
                    ♚ Black:{" "}
                    {game.black_player_id === userId
                      ? "You"
                      : "Opponent"}
                  </p>
                </div>
              </section>

              {/* IN-GAME CHAT */}
              <section className="overflow-hidden rounded-2xl border border-blue-500/30 bg-[var(--panel)]">
                <div className="border-b border-[color:var(--line)] p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold">
                        Game Chat
                      </h2>

                      <p className="mt-1 text-sm text-[color:var(--muted)]">
                        Talk with your opponent.
                      </p>
                    </div>

                    <span className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-[color:var(--good)]">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      Live
                    </span>
                  </div>
                </div>

                <div className="flex h-[350px] flex-col">
                  <div className="flex-1 space-y-3 overflow-y-auto p-4">
                    {chatMessages.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center text-center">
                        <span className="text-4xl">💬</span>

                        <p className="mt-3 text-sm font-medium text-[color:var(--muted)]">
                          No messages yet
                        </p>

                        <p className="mt-1 text-xs text-[color:var(--muted)]">
                          Start the conversation with your opponent.
                        </p>
                      </div>
                    ) : (
                      chatMessages.map((chat) => {
                        const mine = chat.sender_id === userId;

                        return (
                          <div
                            key={chat.id}
                            className={`flex ${
                              mine ? "justify-end" : "justify-start"
                            }`}
                          >
                            <div
                              className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                                mine
                                  ? "rounded-br-sm bg-blue-600 text-white"
                                  : "rounded-bl-sm bg-[var(--panel-2)] text-[color:var(--ink)]"
                              }`}
                            >
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider opacity-70">
                                {mine ? "You" : "Opponent"}
                              </p>

                              <p className="break-words text-sm">
                                {chat.message}
                              </p>

                              <p className="mt-1 text-right text-[10px] opacity-60">
                                {formatChatTime(chat.created_at)}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}

                    <div ref={chatEndRef} />
                  </div>

                  {game.status === "active" ? (
                    <form
                      onSubmit={sendChatMessage}
                      className="border-t border-[color:var(--line)] p-3"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(event) =>
                            setChatInput(event.target.value.slice(0, 1000))
                          }
                          placeholder="Type a message..."
                          maxLength={1000}
                          disabled={chatBusy}
                          className="min-w-0 flex-1 rounded-xl border border-[color:var(--line)] bg-[var(--panel-2)] px-3 py-3 text-sm text-white outline-none placeholder:text-[color:var(--muted)] focus:border-blue-500 disabled:opacity-50"
                        />

                        <button
                          type="submit"
                          disabled={chatBusy || !chatInput.trim()}
                          className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {chatBusy ? "..." : "Send"}
                        </button>
                      </div>

                      <div className="mt-2 flex justify-between text-[10px] text-[color:var(--muted)]">
                        <span>Messages are visible to both players.</span>
                        <span>{chatInput.length}/1000</span>
                      </div>

                      {chatError && (
                        <p className="mt-2 text-xs text-[color:var(--bad)]">
                          {chatError}
                        </p>
                      )}
                    </form>
                  ) : (
                    <div className="border-t border-[color:var(--line)] p-4 text-center text-xs text-[color:var(--muted)]">
                      This game has ended. Chat is now read-only.
                    </div>
                  )}
                </div>
              </section>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

export default function MultiplayerMatchPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-white">
          Loading your match...
        </main>
      }
    >
      <MultiplayerMatchContent />
    </Suspense>
  );
}