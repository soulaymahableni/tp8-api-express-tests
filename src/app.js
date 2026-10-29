import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { healthRouter } from "./routes/health.js";
import { contactRouter } from "./routes/contact.js";
import { errorHandler } from "./middlewares/errorHandler.js";

export function createApp({ contactRepository }) {
  const app = express();

  // Derrière un reverse proxy (Nginx, Ingress) : app.set("trust proxy", 1);

  // Durcissement HTTP (OWASP API8)
  app.disable("x-powered-by");
  app.use(helmet());

  // Corps JSON limité à 10 ko (OWASP API4)
  app.use(express.json({ limit: "10kb" }));

  app.use("/api/health", healthRouter);

  // Rate limiting uniquement sur /api/contact : 5 requêtes / minute / IP (OWASP API4)
  const contactLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 5,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "TOO_MANY_REQUESTS" },
  });
  app.use("/api/contact", contactLimiter, contactRouter({ contactRepository }));

  // Route 404 JSON pour toutes les autres URL
  app.use((req, res) => res.status(404).json({ error: "NOT_FOUND" }));

  // Le middleware d'erreur doit être déclaré EN DERNIER.
  app.use(errorHandler);
  return app;
}
