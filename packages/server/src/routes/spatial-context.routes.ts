import type { FastifyInstance, FastifyReply } from "fastify";
import { updateSpatialContextRequestSchema } from "@marinara-engine/shared";
import {
  createSpatialContextService,
  SpatialContextServiceError,
} from "../services/spatial-context/definition.service.js";

interface ChatSpatialParams {
  chatId: string;
}

function sendServiceError(reply: FastifyReply, error: unknown) {
  if (error instanceof SpatialContextServiceError) {
    return reply.status(error.statusCode).send({ error: error.message, code: error.code });
  }
  throw error;
}

export async function spatialContextRoutes(app: FastifyInstance) {
  const service = createSpatialContextService(app.db);

  app.get<{ Params: ChatSpatialParams }>("/:chatId/spatial-context", async (req, reply) => {
    try {
      return await service.get(req.params.chatId);
    } catch (error) {
      return sendServiceError(reply, error);
    }
  });

  app.put<{ Params: ChatSpatialParams }>("/:chatId/spatial-context", async (req, reply) => {
    const parsed = updateSpatialContextRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.issues[0]?.message ?? "Invalid hierarchical map.",
        code: "spatial_request_invalid",
        issues: parsed.error.issues,
      });
    }

    try {
      return await service.update(req.params.chatId, parsed.data);
    } catch (error) {
      return sendServiceError(reply, error);
    }
  });
}
