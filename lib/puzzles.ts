/**
 * Puzzle ladder.
 *
 * Every position was generated and verified with chess.js: in the position
 * given, exactly one legal move is checkmate. That means the app can grade an
 * answer instantly, with no engine running and no guesswork.
 */

export type Puzzle = {
  id: string;
  /** FEN, White to move */
  fen: string;
  /** the one correct move in UCI */
  solution: string;
  /** the same move in algebraic notation */
  san: string;
  prompt: string;
  hint: string;
};

export type Level = {
  id: number;
  name: string;
  blurb: string;
  xp: number;
  puzzles: Puzzle[];
};

export const LEVELS: Level[] = [
  {
    id: 1,
    name: "Queen finish",
    blurb: "One queen move, no escape.",
    xp: 40,
    puzzles: [
      {
        id: "L1P1",
        fen: "8/8/8/8/Q7/K7/8/k7 w - - 0 1",
        solution: "a4d1",
        san: "Qd1#",
        prompt: "White to move. Mate in one.",
        hint: "The mating piece is your queen.",
      },
      {
        id: "L1P2",
        fen: "8/8/8/Q7/8/K7/8/k7 w - - 0 1",
        solution: "a5e1",
        san: "Qe1#",
        prompt: "White to move. Mate in one.",
        hint: "The mating piece is your queen.",
      },
      {
        id: "L1P3",
        fen: "8/8/Q7/8/8/K7/8/k7 w - - 0 1",
        solution: "a6f1",
        san: "Qf1#",
        prompt: "White to move. Mate in one.",
        hint: "The mating piece is your queen.",
      },
    ],
  },
  {
    id: 2,
    name: "Queen and king box",
    blurb: "Your king covers the exits.",
    xp: 55,
    puzzles: [
      {
        id: "L2P1",
        fen: "8/8/8/8/8/K7/2R5/k7 w - - 0 1",
        solution: "c2c1",
        san: "Rc1#",
        prompt: "White to move. Mate in one.",
        hint: "The mating piece is your rook.",
      },
      {
        id: "L2P2",
        fen: "8/8/8/8/8/K7/3R4/k7 w - - 0 1",
        solution: "d2d1",
        san: "Rd1#",
        prompt: "White to move. Mate in one.",
        hint: "The mating piece is your rook.",
      },
      {
        id: "L2P3",
        fen: "8/Q7/8/8/8/K7/8/k7 w - - 0 1",
        solution: "a7g1",
        san: "Qg1#",
        prompt: "White to move. Mate in one.",
        hint: "The mating piece is your queen.",
      },
    ],
  },
  {
    id: 3,
    name: "Rook ladder",
    blurb: "Cut the board in two.",
    xp: 70,
    puzzles: [
      {
        id: "L3P1",
        fen: "Q7/8/8/8/8/K7/8/k7 w - - 0 1",
        solution: "a8h1",
        san: "Qh1#",
        prompt: "White to move. Mate in one.",
        hint: "The mating piece is your queen.",
      },
      {
        id: "L3P2",
        fen: "1Q6/8/8/8/8/K7/8/k7 w - - 0 1",
        solution: "b8b2",
        san: "Qb2#",
        prompt: "White to move. Mate in one.",
        hint: "The mating piece is your queen.",
      },
      {
        id: "L3P3",
        fen: "8/2Q5/8/8/8/K7/8/k7 w - - 0 1",
        solution: "c7c1",
        san: "Qc1#",
        prompt: "White to move. Mate in one.",
        hint: "The mating piece is your queen.",
      },
    ],
  },
  {
    id: 4,
    name: "Bishop support",
    blurb: "A quiet bishop seals the diagonal.",
    xp: 90,
    puzzles: [
      {
        id: "L4P1",
        fen: "8/8/8/3B4/8/K7/R7/k7 w - - 0 1",
        solution: "d5e4",
        san: "Be4#",
        prompt: "White to move. Mate in one.",
        hint: "The mating piece is your bishop.",
      },
      {
        id: "L4P2",
        fen: "8/8/8/8/2B5/K7/R7/k7 w - - 0 1",
        solution: "c4d3",
        san: "Bd3#",
        prompt: "White to move. Mate in one.",
        hint: "The mating piece is your bishop.",
      },
      {
        id: "L4P3",
        fen: "8/8/4B3/8/8/K7/R7/k7 w - - 0 1",
        solution: "e6f5",
        san: "Bf5#",
        prompt: "White to move. Mate in one.",
        hint: "The mating piece is your bishop.",
      },
    ],
  },
  {
    id: 5,
    name: "Two attackers",
    blurb: "Queen and rook, one last blow.",
    xp: 110,
    puzzles: [
      {
        id: "L5P1",
        fen: "8/8/8/8/R2B4/K7/8/k7 w - - 0 1",
        solution: "a4b4",
        san: "Rb4#",
        prompt: "White to move. Mate in one.",
        hint: "The mating piece is your rook.",
      },
      {
        id: "L5P2",
        fen: "8/8/8/R7/3B4/K7/8/k7 w - - 0 1",
        solution: "a5b5",
        san: "Rb5#",
        prompt: "White to move. Mate in one.",
        hint: "The mating piece is your rook.",
      },
      {
        id: "L5P3",
        fen: "8/8/R7/8/3B4/K7/8/k7 w - - 0 1",
        solution: "a6b6",
        san: "Rb6#",
        prompt: "White to move. Mate in one.",
        hint: "The mating piece is your rook.",
      },
    ],
  },
  {
    id: 6,
    name: "Mixed endings",
    blurb: "Everything you have learned.",
    xp: 140,
    puzzles: [
      {
        id: "L6P1",
        fen: "8/R7/8/8/3B4/K7/8/k7 w - - 0 1",
        solution: "a7b7",
        san: "Rb7#",
        prompt: "White to move. Mate in one.",
        hint: "The mating piece is your rook.",
      },
      {
        id: "L6P2",
        fen: "8/8/8/8/8/K7/4R3/k7 w - - 0 1",
        solution: "e2e1",
        san: "Re1#",
        prompt: "White to move. Mate in one.",
        hint: "The mating piece is your rook.",
      },
      {
        id: "L6P3",
        fen: "8/8/8/8/8/K7/5R2/k7 w - - 0 1",
        solution: "f2f1",
        san: "Rf1#",
        prompt: "White to move. Mate in one.",
        hint: "The mating piece is your rook.",
      },
    ],
  },
];

export const TOTAL_PUZZLES = LEVELS.reduce(
  (count, level) => count + level.puzzles.length,
  0,
);

export const LEVEL_BY_ID = new Map(LEVELS.map((level) => [level.id, level]));

export const PUZZLE_BY_ID = new Map(
  LEVELS.flatMap((level) =>
    level.puzzles.map((puzzle) => [puzzle.id, { ...puzzle, levelId: level.id }] as const),
  ),
);
