import { Router } from 'express';

import { normalizeCardNumber } from '../../../shared/rfid.js';

const router = Router();

// Connected web clients listening for scans over Server-Sent Events.
const clients = new Set();

// Optional shared secret. Set RFID_BRIDGE_TOKEN in server/.env and in the
// ESP32 sketch to stop anybody on the network from posting fake scans.
const BRIDGE_TOKEN = process.env.RFID_BRIDGE_TOKEN || '';

function checkToken(req, res) {
  if (!BRIDGE_TOKEN) return true;
  const given = req.get('x-bridge-token') || '';
  if (given !== BRIDGE_TOKEN) {
    res.status(401).json({ ok: false, error: 'Bad bridge token.' });
    return false;
  }
  return true;
}

/**
 * GET /api/rfid/stream
 * A browser keeps this open to receive scanned UIDs as Server-Sent Events.
 */
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const client = { res };
  clients.add(client);

  // Tell the client it is connected
  res.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  req.on('close', () => {
    clients.delete(client);
  });
});

/**
 * POST /api/rfid/scan
 * The ESP32 (or any bridge) posts a scanned UID here. It is forwarded to
 * every browser listening on /api/rfid/stream.
 */
router.post('/scan', (req, res) => {
  if (!checkToken(req, res)) return;

  const raw = typeof req.body?.uid === 'string' ? req.body.uid : (typeof req.body?.card === 'string' ? req.body.card : '');
  const card = normalizeCardNumber(raw);
  if (!card) {
    return res.status(400).json({ ok: false, error: 'That is not a card number.' });
  }

  const payload = JSON.stringify({ uid: card, at: new Date().toISOString() });
  for (const client of clients) {
    try {
      client.res.write(`event: scan\ndata: ${payload}\n\n`);
    } catch {
      clients.delete(client);
    }
  }

  res.json({ ok: true, uid: card, listeners: clients.size });
});

export default router;