import 'dotenv/config';

import cors from 'cors';
import express, { Request, Response } from 'express';

const app = express();

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const API_KEY = process.env.EXCHANGERATE_API_KEY;
const UPSTREAM_BASE = 'https://v6.exchangerate-api.com/v6';

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  : null;

app.use(
  cors({
    origin: ALLOWED_ORIGINS && ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : true,
  })
);

type CodesResponse = {
  result: string;
  supported_codes: [string, string][];
};

type RatesResponse = {
  result: string;
  base_code: string;
  conversion_rates: Record<string, number>;
};

const ensureApiKey = (res: Response): boolean => {
  if (API_KEY) return true;
  res.status(500).json({ error: 'Missing EXCHANGERATE_API_KEY on the backend' });
  return false;
};

app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.get('/codes', async (_req: Request, res: Response) => {
  if (!ensureApiKey(res)) return;

  const url = `${UPSTREAM_BASE}/${API_KEY}/codes`;

  try {
    const upstream = await fetch(url);
    const json = (await upstream.json()) as CodesResponse;

    if (!upstream.ok || json?.result !== 'success') {
      console.error('Upstream /codes error', json);
      return res.status(502).json({ error: 'Upstream error', details: json });
    }

    res.json(json);
  } catch (error) {
    console.error('Failed to fetch /codes', error);
    res.status(500).json({ error: 'Failed to fetch codes' });
  }
});

app.get('/rates', async (req: Request, res: Response) => {
  if (!ensureApiKey(res)) return;

  const base = (req.query.base || 'USD').toString().toUpperCase();
  const url = `${UPSTREAM_BASE}/${API_KEY}/latest/${encodeURIComponent(base)}`;

  try {
    const upstream = await fetch(url);
    const json = (await upstream.json()) as RatesResponse;

    if (!upstream.ok || json?.result !== 'success') {
      console.error('Upstream /rates error', json);
      return res.status(502).json({ error: 'Upstream error', details: json });
    }

    res.json(json);
  } catch (error) {
    console.error('Failed to fetch /rates', error);
    res.status(500).json({ error: 'Failed to fetch rates' });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`Backend listening on http://${HOST}:${PORT}`);
  if (process.env.PUBLIC_URL) {
    console.log(`Public URL: ${process.env.PUBLIC_URL}`);
  }
});
