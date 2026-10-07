import express, { type Request, type Response, type NextFunction } from "express";
import pinoHttp from "pino-http";
import cors from "cors";
import cookieParser from "cookie-parser";
import docusignRouter from "./routes/docusign.js";

const app = express();

// Handle ES module default/named import interop for pino-http safely
const logger = typeof pinoHttp === "function" ? pinoHttp() : (pinoHttp as any).default();
app.use(logger);

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// Routes
app.use(docusignRouter);

// Basic health check
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Explicit types for error-handling middleware
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  req.log.error({ err }, "Unhandled error");
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

export default app;