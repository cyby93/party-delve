import { Hono } from 'hono';
import { serve } from '@hono/node-server';

const app = new Hono();

// ponytail: in-memory store — PostgreSQL persistence in Epic 7
const playerAchievements = new Map<string, string[]>();

app.patch('/player/:id', async (c) => {
  const body = await c.req.json<{ achievements?: string[] }>();
  if (body.achievements?.length) {
    const existing = playerAchievements.get(c.req.param('id')) ?? [];
    playerAchievements.set(
      c.req.param('id'),
      [...new Set([...existing, ...body.achievements])],
    );
  }
  return c.json({ ok: true });
});

const port = Number(process.env['PORT'] ?? 3001);
serve({ fetch: app.fetch, port });
export { app };
