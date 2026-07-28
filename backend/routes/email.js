const crypto = require('crypto');
const router = require('express').Router();
const { protect, adminOnly } = require('../middleware/auth');
const { sendMail, mailConfigured } = require('../utils/mailer');
const { buildSummaryData, renderSummaryHtml } = require('../services/dailySummary');
const { todayStr } = require('../utils/date');

function timingSafeSecretEquals(provided, expected) {
  if (!provided || !expected) return false;
  const providedBuf = Buffer.from(String(provided));
  const expectedBuf = Buffer.from(String(expected));
  if (providedBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

async function sendTodaysSummary() {
  const { EMAIL_TO } = process.env;
  if (!EMAIL_TO) throw new Error('EMAIL_TO is not set — add the recipient address(es) in your environment/Secrets.');

  const date = todayStr();
  const data = await buildSummaryData(date);
  const html = renderSummaryHtml(data);

  await sendMail({
    to: EMAIL_TO,
    subject: `Dairy Farm Summary — ${date}`,
    html,
    text: `Usman Dairy Farm summary for ${date}. Milk: ${data.totalMilk.toFixed(1)}L, Net today: ₨${data.netToday.toLocaleString()}.`,
  });

  return date;
}

// GET /api/email/status — lets the frontend show whether email is configured, without exposing secrets
router.get('/status', protect, async (req, res) => {
  const { EMAIL_TO } = process.env;
  res.json({
    configured: Boolean(mailConfigured() && EMAIL_TO),
    to: EMAIL_TO ? EMAIL_TO.replace(/(.{2}).+(@.+)/, '$1***$2') : null,
  });
});

// POST /api/email/send-now — admin-triggered manual send, for testing
router.post('/send-now', protect, adminOnly, async (req, res) => {
  try {
    const date = await sendTodaysSummary();
    res.json({ sent: true, date });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/email/cron — triggered by an external free scheduler (e.g. cron-job.org).
// Not protected by user JWT since a cron service can't log in — instead requires a shared secret header.
router.post('/cron', async (req, res) => {
  try {
    const secret = req.header('X-Cron-Secret');
    if (!timingSafeSecretEquals(secret, process.env.CRON_SECRET)) {
      return res.status(401).json({ error: 'Invalid or missing cron secret' });
    }
    const date = await sendTodaysSummary();
    res.json({ sent: true, date });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
