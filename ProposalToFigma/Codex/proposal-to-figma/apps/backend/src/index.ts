import Fastify from "fastify";
import cors from "@fastify/cors";

import { registerDiffDesignRoute } from "./routes/diffDesign";
import { registerParseSheetRoute } from "./routes/parseSheet";

async function bootstrap(): Promise<void> {
  const app = Fastify({
    logger: true
  });

  await app.register(cors, {
    origin: true
  });

  app.get("/health", async () => ({
    ok: true
  }));

  await registerParseSheetRoute(app);
  await registerDiffDesignRoute(app);

  const port = Number(process.env.PORT || 8787);
  const host = process.env.HOST || "0.0.0.0";

  try {
    await app.listen({
      port,
      host
    });
    app.log.info(`Proposal-to-Figma backend listening on http://${host}:${port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void bootstrap();
