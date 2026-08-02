import { Router } from "express";
import { buildAndSendDailyReport } from "../lib/daily-report";
import { logger } from "../lib/logger";

const router = Router();

router.post("/reports/send-daily", async (req, res) => {
  const date = (req.query["date"] as string) || new Date().toISOString().slice(0, 10);
  try {
    await buildAndSendDailyReport(date);
    res.json({ ok: true, message: `Daily report sent for ${date}` });
  } catch (err: any) {
    logger.error({ err: err.message }, "Manual daily report trigger failed");
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
