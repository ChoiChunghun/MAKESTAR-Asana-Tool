import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { buildDesignData } from "../services/designDataBuilder";
import { readProposalColumnB } from "../services/googleSheets";
import { buildProposalData } from "../services/proposalParser";

const parseSheetSchema = z.object({
  spreadsheetUrl: z.string().min(1),
  sheetName: z.string().min(1).optional(),
  range: z.literal("B:B").optional().default("B:B")
});

export async function registerParseSheetRoute(app: FastifyInstance): Promise<void> {
  app.post("/api/parse-sheet", async (request, reply) => {
    try {
      const input = parseSheetSchema.parse(request.body);
      const sheet = await readProposalColumnB(input);
      const proposalData = buildProposalData(sheet);
      const designData = buildDesignData(proposalData);

      return {
        proposalData,
        designData
      };
    } catch (error) {
      request.log.error(error);
      const message = error instanceof Error ? error.message : "시트 파싱에 실패했습니다.";
      return reply.status(400).send({
        error: message
      });
    }
  });
}

