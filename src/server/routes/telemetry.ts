import { Hono } from 'hono';
import { telemetry } from '@devvit/analytics/server/reddit';

/**
 * Devvit Journeys endpoints, matching what the analytics client calls
 * (/api/telemetry/journey/*). The package ships an Express router; this is the
 * same thing for our Hono server. No personal data is ever sent.
 */
export const telemetryRoutes = new Hono();

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0
    ? value.slice(0, 64)
    : undefined;

async function body(c: {
  req: { json: () => Promise<unknown> };
}): Promise<object> {
  const raw: unknown = await c.req.json().catch(() => ({}));
  return raw && typeof raw === 'object' ? raw : {};
}

telemetryRoutes.post('/journey/start', async (c) => {
  try {
    return c.json(await telemetry.startJourney());
  } catch (error) {
    console.error('Journey start failed', error);
    return c.json({ error: 'telemetry failed' }, 500);
  }
});

telemetryRoutes.post('/journey/app-ready', async (c) => {
  try {
    return c.json(await telemetry.appReady());
  } catch (error) {
    console.error('Journey app-ready failed', error);
    return c.json({ error: 'telemetry failed' }, 500);
  }
});

telemetryRoutes.post('/journey/progress', async (c) => {
  const b = await body(c);
  const journeyId = text(Reflect.get(b, 'journeyId'));
  const progress = Number(Reflect.get(b, 'progress'));
  if (
    !journeyId ||
    !Number.isFinite(progress) ||
    progress < 0 ||
    progress > 1
  ) {
    return c.json({ error: 'bad progress event' }, 400);
  }
  const action = text(Reflect.get(b, 'action'));
  const actionDetails = text(Reflect.get(b, 'actionDetails'));
  try {
    return c.json(
      await telemetry.journeyProgress({
        journeyId,
        progress,
        ...(action ? { action } : {}),
        ...(actionDetails ? { actionDetails } : {}),
      })
    );
  } catch (error) {
    console.error('Journey progress failed', error);
    return c.json({ error: 'telemetry failed' }, 500);
  }
});

telemetryRoutes.post('/journey/interaction', async (c) => {
  const b = await body(c);
  const action = text(Reflect.get(b, 'action'));
  if (!action) {
    return c.json({ error: 'action is required' }, 400);
  }
  try {
    return c.json(
      await telemetry.journeyInteraction({
        journeyId: text(Reflect.get(b, 'journeyId')) ?? '',
        action,
        actionDetails: text(Reflect.get(b, 'actionDetails')) ?? '',
      })
    );
  } catch (error) {
    console.error('Journey interaction failed', error);
    return c.json({ error: 'telemetry failed' }, 500);
  }
});

telemetryRoutes.post('/journey/end', async (c) => {
  const b = await body(c);
  const journeyId = text(Reflect.get(b, 'journeyId'));
  if (!journeyId) {
    return c.json({ error: 'journeyId is required' }, 400);
  }
  const game: unknown = Reflect.get(b, 'game');
  const win =
    game && typeof game === 'object'
      ? Reflect.get(game, 'win') === true
      : false;
  const score =
    game && typeof game === 'object' ? Number(Reflect.get(game, 'score')) : 0;
  try {
    return c.json(
      await telemetry.endJourney({
        journeyId,
        complete: Reflect.get(b, 'complete') === true,
        ...(game
          ? { game: { win, score: Number.isFinite(score) ? score : 0 } }
          : {}),
      })
    );
  } catch (error) {
    console.error('Journey end failed', error);
    return c.json({ error: 'telemetry failed' }, 500);
  }
});
