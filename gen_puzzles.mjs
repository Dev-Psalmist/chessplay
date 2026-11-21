import { Chess } from "chess.js";
const F = ["a","b","c","d","e","f","g","h"];
const SQ = []; for (const f of F) for (let r=1;r<=8;r++) SQ.push(f+r);
const idx = (s) => [F.indexOf(s[0]), parseInt(s[1],10)];
const near = (a, b) => Math.max(Math.abs(idx(a)[0]-idx(b)[0]), Math.abs(idx(a)[1]-idx(b)[1]));

function analyse(pieces) {
  const c = new Chess(); c.clear();
  for (const [sq, code] of Object.entries(pieces)) {
    try { c.put({ type: code[1].toLowerCase(), color: code[0] === "w" ? "w" : "b" }, sq); } catch { return null; }
  }
  let probe; try { probe = new Chess(c.fen()); } catch { return null; }
  if (probe.isGameOver() || probe.isCheck()) return null;
  const moves = probe.moves({ verbose: true });
  const mates = [];
  for (const m of moves) {
    const t = new Chess(probe.fen());
    try { t.move({ from: m.from, to: m.to, promotion: m.promotion }); } catch { continue; }
    if (t.isCheckmate()) mates.push(m);
  }
  if (mates.length !== 1) return null;
  const m = mates[0];
  return { fen: probe.fen(), uci: m.from + m.to + (m.promotion ?? ""), san: m.san };
}

const edge = SQ.filter((s) => /[ah]/.test(s) || /[18]/.test(s));
const extra = ["d4","e4","d5","e5","c4","f4","c5","f5","d3","e6"];
const found = []; const seen = new Set();
const push = (r, plan) => { if (r && !seen.has(r.fen + r.san)) { seen.add(r.fen + r.san); found.push({ ...r, plan }); } };

const want = [7, 7, 4, 4, 4];
const have = () => [0,1,2,3,4].map(p => found.filter(f => f.plan === p).length);
const enough = () => have().every((n, i) => n >= want[i]);

for (const bk of edge) {
  if (enough()) break;
  const wkCandidates = SQ.filter((s) => s !== bk && near(s, bk) <= 2);
  for (const wk of wkCandidates) {
    for (const a of SQ) {
      if (a === bk || a === wk) continue;
      push(analyse({ [bk]: "bK", [wk]: "wK", [a]: "wQ" }), 0);
      push(analyse({ [bk]: "bK", [wk]: "wK", [a]: "wR" }), 1);
      for (const b of extra) {
        if (have()[2] >= want[2] && have()[3] >= want[3] && have()[4] >= want[4]) break;
        if (b === bk || b === wk || b === a) continue;
        push(analyse({ [bk]: "bK", [wk]: "wK", [a]: "wQ", [b]: "wR" }), 2);
        push(analyse({ [bk]: "bK", [wk]: "wK", [a]: "wQ", [b]: "wB" }), 3);
        push(analyse({ [bk]: "bK", [wk]: "wK", [a]: "wR", [b]: "wB" }), 4);
      }
    }
  }
}
console.error("found", found.length, "by plan", [0,1,2,3,4].map(p=>found.filter(f=>f.plan===p).length));
console.log(JSON.stringify(found));
