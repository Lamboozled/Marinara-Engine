// ──────────────────────────────────────────────
// Zustand Store: 8-Ball Pool Table (turn-game #4)
// ──────────────────────────────────────────────
// Holds the live, per-viewer 8-ball snapshot pushed by the server
// (turn_game_state_patch SSE, dispatched by gameType) or fetched on mount.
// chatId-guarded so a background chat's game can never paint over the visible
// table. Synchronous only — all async lives in use-eightball.ts.
import { create } from "zustand";
import type { EightBallPublicView } from "@marinara-engine/shared";

export type EightBallBoardSnapshot = EightBallPublicView & { chatId: string };

interface EightBallGameStore {
  current: EightBallBoardSnapshot | null;
  /** Chat whose setup modal is open (null = closed). Driven by the /8ball command. */
  setupChatId: string | null;
  /** Replace the table with a fresh server snapshot for a chat. */
  setEightBall: (view: EightBallPublicView, chatId: string) => void;
  /** Clear the table (optionally only if it belongs to a given chat). */
  clearEightBall: (chatId?: string) => void;
  /** Open the game-setup modal for a chat. */
  openSetup: (chatId: string) => void;
  closeSetup: () => void;
  reset: () => void;
}

export const useEightBallGameStore = create<EightBallGameStore>((set) => ({
  current: null,
  setupChatId: null,
  setEightBall: (view, chatId) => set({ current: { ...view, chatId } }),
  clearEightBall: (chatId) =>
    set((state) => (!chatId || state.current?.chatId === chatId ? { current: null } : {})),
  openSetup: (chatId) => set({ setupChatId: chatId }),
  closeSetup: () => set({ setupChatId: null }),
  reset: () => set({ current: null, setupChatId: null }),
}));
