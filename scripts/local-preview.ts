// Serves the built client with a fake API so screens can be checked in a normal browser.
// Usage: npm run build && npm run preview:local -- [YYYY-MM-DD] [port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import type { AccuseResult, CaseResponse } from '../src/shared/api.ts';
import { generateCase, toPublicCase } from '../src/shared/puzzle/generator.ts';

const date = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const port = Number(process.argv[3] ?? '5178');
const root = join(import.meta.dirname, '..', 'dist', 'client');
let c = generateCase(date);
// NEW_PLAYER=1 shows the game the way a first-time visitor sees it on launch
// day: no test bar, no streak, no results from yesterday.
const newPlayer = process.env['NEW_PLAYER'] === '1';

/** A stand-in for a real snoovatar: tall, transparent, full body. */
const MOCK_AVATAR = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 600">
<ellipse cx="190" cy="430" rx="95" ry="120" fill="#FF4500"/>
<ellipse cx="190" cy="240" rx="130" ry="105" fill="#fff" stroke="#141414" stroke-width="8"/>
<circle cx="145" cy="235" r="18" fill="#FF4500"/><circle cx="235" cy="235" r="18" fill="#FF4500"/>
<path d="M140 285 Q190 315 240 285" fill="none" stroke="#141414" stroke-width="8"/>
<line x1="190" y1="135" x2="215" y2="70" stroke="#141414" stroke-width="8"/>
<circle cx="222" cy="60" r="18" fill="#fff" stroke="#141414" stroke-width="8"/>
</svg>`;

const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.map': 'application/json',
};

let result: AccuseResult | null = null;

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  if (url.pathname === '/api/case') {
    const wanted = url.searchParams.get('date');
    if (wanted && wanted !== c.id) {
      c = generateCase(wanted);
      result = null;
    }
    const body: CaseResponse = {
      type: 'case',
      case: toPublicCase(c),
      username: 'local_tester',
      result,
      streak: newPlayer ? { current: 0, best: 0 } : { current: 6, best: 9 },
      yesterday: newPlayer
        ? null
        : {
            number: c.number - 1,
            culprit: 'linda',
            topBlamed: 'agnes',
            topBlamedPct: 64,
            correctPct: 21,
            totalPlayers: 812,
          },
      playersSoFar: 0,
      testMode: !newPlayer,
      commented: false,
      subredditName: 'WhoFartedDaily',
      returning: !newPlayer,
      // OLD_CASE=1 previews an old case post with the link to today's case.
      today: process.env.OLD_CASE
        ? { number: c.number + 3, url: 'https://www.reddit.com/r/WhoFartedDaily/' }
        : null,
    };
    res
      .writeHead(200, { 'Content-Type': 'application/json' })
      .end(JSON.stringify(body));
    return;
  }
  if (url.pathname === '/api/accuse' && req.method === 'POST') {
    let raw = '';
    for await (const chunk of req) {
      raw += String(chunk);
    }
    const input = JSON.parse(raw);
    const blame = c.suspects.map((s, i) => ({
      id: s.id,
      count: [310, 220, 140, 90, 40, 12][i] ?? 0,
    }));
    result = {
      correct: input.suspect === c.solution.culprit,
      guessed: input.suspect,
      culprit: c.solution.culprit,
      lunches: c.solution.lunches,
      seconds: input.seconds,
      cluesRead: input.cluesRead,
      hints: input.hints,
      blame: blame.sort((a, b) => b.count - a.count),
      totalPlayers: blame.reduce((t, b) => t + b.count, 0),
      streak: newPlayer
        ? { current: input.suspect === c.solution.culprit ? 1 : 0, best: 1 }
        : { current: 7, best: 9 },
    };
    res
      .writeHead(200, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ type: 'accuse', result }));
    return;
  }
  // EMPTY_BOARD=1 shows the boards on a day nobody has played yet.
  if (url.pathname === '/api/leaderboard') {
    const empty = process.env['EMPTY_BOARD'] === '1';
    const names = [
      'nose_knows',
      'beanqueen',
      'sherlock_smells',
      'gas_detective',
      'pipfan99',
    ];
    const today = empty
      ? []
      : names.map((username, i) => ({
          rank: i + 1,
          username,
          value: 31 + i * 17,
        }));
    const me =
      result && result.correct
        ? { rank: 7, username: 'local_tester', value: result.seconds }
        : null;
    const streaks = empty
      ? []
      : [
          { rank: 1, username: 'sherlock_smells', value: 12 },
          { rank: 2, username: 'local_tester', value: 7 },
          { rank: 3, username: 'beanqueen', value: 4 },
          { rank: 4, username: 'nose_knows', value: 2 },
          { rank: 5, username: 'a_really_long_reddit_username_here', value: 1 },
        ];
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(
      JSON.stringify({
        type: 'leaderboard',
        username: 'local_tester',
        today,
        todayCount: empty ? (me ? 1 : 0) : 9,
        me,
        streaks,
      })
    );
    return;
  }
  // NO_AVATAR=1 shows the card for a player without a snoovatar.
  if (url.pathname === '/api/avatar') {
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(
      JSON.stringify({
        type: 'avatar',
        username: 'local_tester',
        url: process.env['NO_AVATAR'] === '1' ? null : '/mock-avatar.svg',
      })
    );
    return;
  }
  if (url.pathname === '/mock-avatar.svg') {
    res.writeHead(200, { 'Content-Type': 'image/svg+xml' }).end(MOCK_AVATAR);
    return;
  }
  if (url.pathname === '/api/join' && req.method === 'POST') {
    res
      .writeHead(200, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ type: 'join' }));
    return;
  }
  if (url.pathname === '/api/comment' && req.method === 'POST') {
    res
      .writeHead(200, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ type: 'comment', alreadyPosted: false }));
    return;
  }
  if (url.pathname === '/api/test/reset' || url.pathname === '/api/reset') {
    result = null;
    res
      .writeHead(200, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ type: 'reset' }));
    return;
  }
  const path = normalize(
    url.pathname === '/' ? '/game.html' : url.pathname
  ).replace(/^(\.\.[/\\])+/, '');
  try {
    const file = await readFile(join(root, path));
    res
      .writeHead(200, {
        'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream',
      })
      .end(file);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(port, () => {
  console.log(
    `Local preview of case ${date} at http://localhost:${port}/game.html (feed card: /splash.html)`
  );
});
