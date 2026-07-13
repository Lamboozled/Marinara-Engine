import { and, desc, eq } from "drizzle-orm";
import type { SpatialContextSnapshot, SpatialSnapshotSource } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { spatialContextSnapshots } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";

type SpatialSnapshotConnection = Pick<DB, "select" | "insert" | "delete">;

export interface CreateSpatialSnapshotInput {
  chatId: string;
  messageId?: string;
  swipeIndex?: number;
  currentLocationId: string | null;
  definitionRevision: number;
  source: SpatialSnapshotSource;
  transitionCommandId?: string | null;
}

function mapSnapshot(row: typeof spatialContextSnapshots.$inferSelect): SpatialContextSnapshot {
  return {
    id: row.id,
    chatId: row.chatId,
    messageId: row.messageId,
    swipeIndex: row.swipeIndex,
    currentLocationId: row.currentLocationId,
    definitionRevision: row.definitionRevision,
    source: row.source as SpatialSnapshotSource,
    transitionCommandId: row.transitionCommandId,
    createdAt: row.createdAt,
  };
}

export function createSpatialContextStorage(db: SpatialSnapshotConnection) {
  return {
    async getLatest(chatId: string): Promise<SpatialContextSnapshot | null> {
      const rows = await db
        .select()
        .from(spatialContextSnapshots)
        .where(eq(spatialContextSnapshots.chatId, chatId))
        .orderBy(desc(spatialContextSnapshots.createdAt), desc(spatialContextSnapshots.id))
        .limit(1);
      return rows[0] ? mapSnapshot(rows[0]) : null;
    },

    async getBootstrap(chatId: string): Promise<SpatialContextSnapshot | null> {
      const rows = await db
        .select()
        .from(spatialContextSnapshots)
        .where(and(eq(spatialContextSnapshots.chatId, chatId), eq(spatialContextSnapshots.messageId, "")))
        .orderBy(desc(spatialContextSnapshots.createdAt), desc(spatialContextSnapshots.id))
        .limit(1);
      return rows[0] ? mapSnapshot(rows[0]) : null;
    },

    async create(input: CreateSpatialSnapshotInput): Promise<SpatialContextSnapshot> {
      const row: typeof spatialContextSnapshots.$inferInsert = {
        id: newId(),
        chatId: input.chatId,
        messageId: input.messageId ?? "",
        swipeIndex: input.swipeIndex ?? 0,
        currentLocationId: input.currentLocationId,
        definitionRevision: input.definitionRevision,
        source: input.source,
        transitionCommandId: input.transitionCommandId ?? null,
        createdAt: now(),
      };
      await db.insert(spatialContextSnapshots).values(row);
      return mapSnapshot(row as typeof spatialContextSnapshots.$inferSelect);
    },

    async replaceBootstrap(input: Omit<CreateSpatialSnapshotInput, "messageId" | "swipeIndex">) {
      await db
        .delete(spatialContextSnapshots)
        .where(and(eq(spatialContextSnapshots.chatId, input.chatId), eq(spatialContextSnapshots.messageId, "")));
      return this.create({ ...input, messageId: "", swipeIndex: 0 });
    },
  };
}
