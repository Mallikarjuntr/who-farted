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
const c = generateCase(date);

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
    const body: CaseResponse = {
      type: 'case',
      case: toPublicCase(c),
      username: 'local_tester',
      result,
      streak: { current: 6, best: 9 },
      yesterday: {
        number: c.number - 1,
        culprit: 'linda',
        topBlamed: 'agnes',
        topBlamedPct: 64,
        correctPct: 21,
        totalPlayers: 812,
      },
      playersSoFar: 0,
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
      streak: { current: 7, best: 9 },
    };
    res
      .writeHead(200, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ type: 'accuse', result }));
    return;
  }
  if (url.pathname === '/api/reset') {
    result = null;
    res.writeHead(200).end('reset');
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
