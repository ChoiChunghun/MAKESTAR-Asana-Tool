import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { buildDesignData, diffOutputs, findOutputById, getCachedDesignData } from "../services/designDataBuilder";
import { readProposalColumnB } from "../services/googleSheets";
import { buildProposalData } from "../services/proposalParser";

const diffSchema = z.object({
  spreadsheetUrl: z.string().min(1),
  sheetName: z.string().min(1).optional(),
  range: z.literal("B:B").optional().default("B:B"),
  previousSourceHash: z.string().min(1),
  outputId: z.string().min(1)
});

export async function registerDiffDesignRoute(app: FastifyInstance): Promise<void> {
  app.post("/api/designs/diff", async (request, reply) => {
    try {
      const input = diffSchema.parse(request.body);
      const sheet = await readProposalColumnB(input);
      const proposalData = buildProposalData(sheet);
      const designData = buildDesignData(proposalData);
      const output = findOutputById(designData, input.outputId);
      const previousDesignData = getCachedDesignData(input.previousSourceHash);
      const previousOutput = previousDesignData?.outputs.find((candidate) => candidate.outputId === input.outputId);
      const changedFields =
        input.previousSourceHash === designData.sourceHash ? [] : diffOutputs(previousOutput, output);

      return {
        hasChanges: input.previousSourceHash !== designData.sourceHash,
        previousSourceHash: input.previousSourceHash,
        currentSourceHash: designData.sourceHash,
        changedFields,
        designData,
        output
      };
    } catch (error) {
      request.log.error(error);
      const message = error instanceof Error ? error.message : "디자인 diff 계산에 실패했습니다.";
      return reply.status(400).send({
        error: message
      });
    }
  });
}

