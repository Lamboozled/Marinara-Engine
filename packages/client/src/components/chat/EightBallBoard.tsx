// ──────────────────────────────────────────────
// EightBallBoard — live, interactive 8-ball pool table (conversation mode)
// ──────────────────────────────────────────────
// A real React component driven by the eightball-game store (fed by
// turn_game_state_patch SSE + an initial fetch). Renders the table as pure
// inline SVG (no image assets, matching ChessBoard/PokerBoard), the SAME shot
// menu the bots see (desc + tier + successPct), a style toggle, aim-line
// preview for the selected candidate, rack score, ball-in-hand / on-the-8
// banners, and a rack_over / finished recap. Table felt/rail/ball colors are
// hardcoded — they're physical object colors (like ChessBoard's square tones
// and PokerBoard's white card faces), not theme surfaces.
import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  CUE_ID,
  EIGHT_ID,
  POCKETS,
  STRIPE_IDS,
  TABLE_HEIGHT,
  TABLE_WIDTH,
  type EightBallPublicCandidate,
  type PocketId,
  type ShotStyle,
  type ShotTier,
} from "@marinara-engine/shared";
import { useChatStore } from "../../stores/chat.store";
import { useEightBallGameStore } from "../../stores/eightball-game.store";
import { useEightBallMove, useEightBallState, useResignEightBall } from "../../hooks/use-eightball";

interface Props {
  chatId: string;
}

// ── table + ball rendering constants (viewBox units, NOT the physical inches
// the engine reasons in — the physical geometry lives in `balls[].x/y`) ─────
const RAIL = 4;
const VIEW_W = TABLE_WIDTH + RAIL * 2;
const VIEW_H = TABLE_HEIGHT + RAIL * 2;
// The true physical ball radius (1.125" of a 100"-wide table) renders as a
// barely-visible speck at chat-card widths, so the glyph is drawn larger than
// scale for legibility — a deliberate visual-only liberty, not a geometry
// change (aim lines still use the real ball/pocket coordinates).
const BALL_VISUAL_R = 2.1;
const POCKET_VISUAL_R = 2.6;

const FELT_COLOR = "#0b6e3f";
const FELT_SHADOW = "#095c34";
const RAIL_COLOR = "#5a3820";
const POCKET_COLOR = "#111318";

const STRIPE_SET = new Set<number>(STRIPE_IDS);

// Standard bar-table ball colors, id 1-7 solids / 9-15 the same 7 colors striped.
const BALL_COLOR: Record<number, string> = {
  1: "#f2c230",
  2: "#2159c9",
  3: "#d42a2a",
  4: "#6a2e93",
  5: "#e8720c",
  6: "#1f7a3d",
  7: "#7a2323",
  9: "#f2c230",
  10: "#2159c9",
  11: "#d42a2a",
  12: "#6a2e93",
  13: "#e8720c",
  14: "#1f7a3d",
  15: "#7a2323",
};

const TIER_LABEL: Record<ShotTier, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  very_hard: "Very hard",
};

const TIER_CLASS: Record<ShotTier, string> = {
  easy: "bg-emerald-500/15 text-emerald-600",
  medium: "bg-amber-500/15 text-amber-600",
  hard: "bg-orange-500/15 text-orange-600",
  very_hard: "bg-red-500/15 text-red-600",
};

const KIND_LABEL: Record<EightBallPublicCandidate["kind"], string> = {
  pot: "Pot",
  bank: "Bank",
  safety: "Safety",
  break: "Break",
};

// ── ball glyph (reused at full size on the table and shrunk in the trays) ──

function PoolBall({ id, cx, cy, r = BALL_VISUAL_R }: { id: number; cx: number; cy: number; r?: number }) {
  if (id === CUE_ID) {
    return <circle cx={cx} cy={cy} r={r} fill="#f7f6f0" stroke="#b6b2a6" strokeWidth={r * 0.08} />;
  }
  const color = BALL_COLOR[id] ?? "#161618";
  const stripe = STRIPE_SET.has(id);
  const clipId = `eb-clip-${id}-${cx}-${cy}`;
  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={stripe ? "#f7f6f0" : color} />
      {stripe && (
        <rect
          x={cx - r}
          y={cy - r * 0.52}
          width={r * 2}
          height={r * 1.04}
          fill={color}
          clipPath={`url(#${clipId})`}
        />
      )}
      <circle cx={cx} cy={cy} r={r * 0.42} fill="#f7f6f0" />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={r * 0.62}
        fontWeight={700}
        fill="#161618"
      >
        {id}
      </text>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,0,0,0.28)" strokeWidth={r * 0.06} />
    </g>
  );
}

function TrayBall({ id }: { id: number }) {
  return (
    <svg viewBox="0 0 8 8" className="h-4 w-4 shrink-0" role="img" aria-label={`ball ${id}`}>
      <PoolBall id={id} cx={4} cy={4} r={3.5} />
    </svg>
  );
}

// ── component ─────────────────────────────────────────────────────────────────

export function EightBallBoard({ chatId }: Props) {
  const current = useEightBallGameStore((s) => s.current);
  const streaming = useChatStore((s) => s.isStreaming);
  const streamingChatId = useChatStore((s) => s.streamingChatId);
  const isStreaming = streaming && streamingChatId === chatId;
  const move = useEightBallMove(chatId);
  const resign = useResignEightBall(chatId);

  // Hydrate the table on mount / chat switch (no-op if no active game).
  const active = !!current && current.chatId === chatId;
  useEightBallState(active ? null : chatId);

  const view = active ? current : null;
  const disabled = isStreaming || move.isPending || resign.isPending;
  const isMyTurn = !!view && view.status === "active" && view.currentSeatId === view.yourSeatId;

  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  const [style, setStyle] = useState<ShotStyle>("controlled");
  useEffect(() => {
    setSelectedShotId(null);
  }, [chatId, view?.currentSeatId, view?.rackNumber]);

  // The break candidate menu is a single entry — auto-select it so "Break" is
  // one click instead of pick-then-click.
  useEffect(() => {
    if (view?.phase === "break" && view.yourShots?.length === 1) {
      setSelectedShotId(view.yourShots[0]!.id);
    }
  }, [view?.phase, view?.yourShots]);

  const selectedCandidate = useMemo(
    () => view?.yourShots?.find((c) => c.id === selectedShotId) ?? null,
    [view?.yourShots, selectedShotId],
  );

  if (!view) return null;

  const onTable = view.balls.filter((b) => !b.pocketed);
  const pocketedBalls = view.balls.filter((b) => b.pocketed).sort((a, b) => a.id - b.id);
  const cueBall = onTable.find((b) => b.id === CUE_ID) ?? null;

  const you = view.seats.find((s) => s.seatId === view.yourSeatId) ?? null;
  const opponent = view.seats.find((s) => s.seatId !== view.yourSeatId) ?? null;
  const currentSeat = view.seats.find((s) => s.seatId === view.currentSeatId) ?? null;
  const winner = view.winnerSeatId ? view.seats.find((s) => s.seatId === view.winnerSeatId) : null;
  const ballInHandForYou = view.ballInHandFor === view.yourSeatId;
  const ballInHandForOpponent = !!view.ballInHandFor && view.ballInHandFor !== view.yourSeatId;

  const submit = () => {
    if (disabled || !selectedShotId) return;
    move.mutate({ move: { type: "shoot", shotId: selectedShotId, style } });
    setSelectedShotId(null);
  };

  const nextRack = () => {
    if (disabled) return;
    move.mutate({ move: { type: "next_rack" } });
  };

  // Aim-line preview for the selected pot/bank candidate: cue→target ball,
  // target ball→pocket. Skipped for safeties (no intended pot) and when the
  // cue isn't on the table (ball-in-hand — the virtual placement is internal
  // to the engine and not exposed to the client).
  const aimLines = (() => {
    if (!selectedCandidate || (selectedCandidate.kind !== "pot" && selectedCandidate.kind !== "bank")) return null;
    const ballId = selectedCandidate.ballId;
    const pocketId = selectedCandidate.pocketId as PocketId | undefined;
    if (ballId === undefined || !pocketId) return null;
    const target = onTable.find((b) => b.id === ballId);
    if (!target) return null;
    const pocket = POCKETS[pocketId];
    return {
      cueToBall: cueBall ? { x1: cueBall.x, y1: cueBall.y, x2: target.x, y2: target.y } : null,
      ballToPocket: { x1: target.x, y1: target.y, x2: pocket.pos.x, y2: pocket.pos.y },
    };
  })();

  const groupLabel = (g: string | null) => (g === "solids" ? "SOLIDS" : g === "stripes" ? "STRIPES" : "open table");

  const seatChip = (seat: typeof you) =>
    seat && (
      <div
        className={`flex items-center gap-1.5 rounded-lg px-1.5 py-1 ${
          seat.isCurrent ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/40" : "ring-1 ring-[var(--border)]"
        }`}
      >
        <div className="leading-tight">
          <div className="flex items-center gap-1 text-xs font-medium text-[var(--foreground)]">
            {seat.displayName}
            {seat.seatId === view.yourSeatId && (
              <span className="text-[0.6rem] font-semibold text-[var(--muted-foreground)]">(you)</span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[0.65rem] text-[var(--muted-foreground)]">
            <span>{groupLabel(seat.group)}</span>
            <span>· {seat.racksWon} rack{seat.racksWon === 1 ? "" : "s"}</span>
          </div>
        </div>
      </div>
    );

  return (
    <div className="mx-2 mb-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-sm">
      {/* Header: seats + rack score + status + resign */}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
        <span className="font-semibold text-[var(--foreground)]">
          8-Ball — Race to {view.raceTo} · Rack {view.rackNumber}
        </span>
        {seatChip(opponent)}
        {seatChip(you)}
        <div className="ml-auto flex items-center gap-2">
          {view.status === "active" && (
            <span className={isMyTurn ? "font-semibold text-[var(--primary)] animate-pulse" : ""}>
              {isMyTurn ? "Your turn" : `${currentSeat?.displayName ?? "…"} is thinking…`}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              if (view.status === "finished" || window.confirm("End this pool game?")) resign.mutate();
            }}
            className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)] active:scale-90"
            title={view.status === "finished" ? "Close" : "End game"}
            aria-label={view.status === "finished" ? "Close game" : "End game"}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Finished banner */}
      {view.status === "finished" && (
        <div className="mb-2 rounded-lg bg-[var(--primary)]/10 px-3 py-2 text-center text-sm font-semibold text-[var(--primary)]">
          {winner ? `🏆 ${winner.displayName} wins the match!` : "Game over"}
        </div>
      )}

      {/* Ball-in-hand / on-the-8 banners */}
      {ballInHandForYou && view.status === "active" && (
        <div className="mb-2 rounded-lg bg-amber-500/10 px-3 py-1.5 text-center text-xs font-semibold text-amber-600">
          Ball in hand — pick any shot, the cue is placed for you.
        </div>
      )}
      {ballInHandForOpponent && view.status === "active" && (
        <div className="mb-2 rounded-lg bg-amber-500/10 px-3 py-1.5 text-center text-xs font-semibold text-amber-600">
          {currentSeat?.displayName ?? "Opponent"} has ball in hand.
        </div>
      )}
      {view.onTheEight && view.status === "active" && (
        <div className="mb-2 rounded-lg bg-red-500/10 px-3 py-1.5 text-center text-xs font-semibold text-red-600">
          {isMyTurn ? "You're" : `${currentSeat?.displayName ?? "They're"} is`} on the 8.
        </div>
      )}

      {/* Table */}
      <div className="mx-auto w-full max-w-md">
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="h-auto w-full" role="img" aria-label="8-ball pool table">
          <rect x={0} y={0} width={VIEW_W} height={VIEW_H} rx={2} fill={RAIL_COLOR} />
          <rect x={RAIL} y={RAIL} width={TABLE_WIDTH} height={TABLE_HEIGHT} fill={FELT_COLOR} />
          <rect x={RAIL} y={RAIL} width={TABLE_WIDTH} height={TABLE_HEIGHT} fill="none" stroke={FELT_SHADOW} strokeWidth={0.4} />
          {Object.values(POCKETS).map((p) => (
            <circle key={p.id} cx={p.pos.x + RAIL} cy={p.pos.y + RAIL} r={POCKET_VISUAL_R} fill={POCKET_COLOR} />
          ))}
          {/* Aim-line preview for the selected candidate */}
          {aimLines?.cueToBall && (
            <line
              x1={aimLines.cueToBall.x1 + RAIL}
              y1={aimLines.cueToBall.y1 + RAIL}
              x2={aimLines.cueToBall.x2 + RAIL}
              y2={aimLines.cueToBall.y2 + RAIL}
              stroke="#ffe066"
              strokeWidth={0.3}
              strokeDasharray="1.2,0.8"
            />
          )}
          {aimLines?.ballToPocket && (
            <line
              x1={aimLines.ballToPocket.x1 + RAIL}
              y1={aimLines.ballToPocket.y1 + RAIL}
              x2={aimLines.ballToPocket.x2 + RAIL}
              y2={aimLines.ballToPocket.y2 + RAIL}
              stroke="#ffffff"
              strokeWidth={0.3}
              strokeDasharray="1.2,0.8"
              opacity={0.85}
            />
          )}
          {/* Balls on the table — cue simply absent from `onTable` while ball-in-hand
              for either seat, so nothing extra is needed to avoid rendering it. */}
          {onTable
            .filter((b) => b.id !== EIGHT_ID)
            .map((b) => (
              <PoolBall key={b.id} id={b.id} cx={b.x + RAIL} cy={b.y + RAIL} />
            ))}
          {onTable
            .filter((b) => b.id === EIGHT_ID)
            .map((b) => (
              <PoolBall key={b.id} id={b.id} cx={b.x + RAIL} cy={b.y + RAIL} />
            ))}
        </svg>
      </div>

      {/* Pocketed-ball trays */}
      {pocketedBalls.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-3">
          {(["solids", "stripes"] as const).map((group) => {
            const balls = pocketedBalls.filter((b) => (group === "solids" ? b.id < 8 : b.id > 8));
            if (balls.length === 0) return null;
            return (
              <div key={group} className="flex items-center gap-1">
                <span className="text-[0.6rem] font-semibold text-[var(--muted-foreground)]">
                  {group === "solids" ? "Solids" : "Stripes"}
                </span>
                <div className="flex gap-0.5">
                  {balls.map((b) => (
                    <TrayBall key={b.id} id={b.id} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Shot menu — the SAME candidate list the bots see */}
      {isMyTurn && view.yourShots && view.yourShots.length > 0 && (
        <div className="mt-2 space-y-1.5 rounded-lg border border-[var(--border)] bg-[var(--muted)]/20 p-2">
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {view.yourShots.map((shot) => (
              <button
                key={shot.id}
                type="button"
                onClick={() => setSelectedShotId(shot.id)}
                disabled={disabled}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors disabled:opacity-50 ${
                  selectedShotId === shot.id
                    ? "bg-[var(--primary)]/15 ring-1 ring-[var(--primary)]"
                    : "hover:bg-[var(--muted)]"
                }`}
              >
                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[0.6rem] font-semibold ${TIER_CLASS[shot.tier]}`}>
                  {TIER_LABEL[shot.tier]}
                </span>
                <span className="flex-1 truncate text-[var(--foreground)]">{shot.desc}</span>
                <span className="shrink-0 text-[0.65rem] text-[var(--muted-foreground)]">{shot.successPct}%</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <div className="flex overflow-hidden rounded-lg border border-[var(--border)] text-xs">
              {(["controlled", "aggressive"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStyle(s)}
                  className={`px-2 py-1 font-medium capitalize transition-colors ${
                    style === s
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : "bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--muted)]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={disabled || !selectedShotId}
              onClick={submit}
              className="ml-auto rounded-lg bg-[var(--primary)] px-4 py-1.5 text-sm font-semibold text-[var(--primary-foreground)] transition-transform active:scale-95 disabled:opacity-40"
            >
              {selectedCandidate ? (view.phase === "break" ? "Break" : KIND_LABEL[selectedCandidate.kind]) : "Pick a shot"}
            </button>
          </div>
        </div>
      )}

      {/* Rack over — human paces to the next rack */}
      {view.status === "rack_over" && view.currentSeatId === view.yourSeatId && (
        <div className="mt-2 flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--muted)]/25 p-2">
          <span className="text-xs text-[var(--muted-foreground)]">{view.lastAction?.summary ?? "Rack over."}</span>
          <button
            type="button"
            disabled={disabled}
            onClick={nextRack}
            className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm font-semibold text-[var(--primary-foreground)] transition-transform active:scale-95 disabled:opacity-40"
          >
            Next rack
          </button>
        </div>
      )}

      {/* Last action ticker + recent log */}
      {view.status !== "finished" && (view.lastAction || view.recentLog.length > 0) && (
        <div className="mt-1.5 space-y-0.5 text-[0.7rem] text-[var(--muted-foreground)]">
          {view.lastAction && (
            <div className="truncate">
              {view.seats.find((s) => s.seatId === view.lastAction!.seatId)?.displayName ?? "—"} {view.lastAction.summary}
            </div>
          )}
          {view.recentLog.length > 0 && (
            <ul className="space-y-0.5">
              {view.recentLog.slice(-4).map((entry, i) => (
                <li key={i} className="truncate opacity-70">
                  {entry.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
