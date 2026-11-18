# Who Farted?

A daily comedic whodunit for Reddit. Six suspects share a lift, someone farts, and you get **one guess** to find out who. A new case is posted and pinned every day at 00:00 UTC in [r/WhoFartedDaily](https://www.reddit.com/r/WhoFartedDaily/).

Built on [Devvit Web](https://developers.reddit.com/) for Reddit's Game of the Day hackathon.

## The suspects

| Suspect | Who they are   | How they give clues                |
| ------- | -------------- | ---------------------------------- |
| Agnes   | Grandma        | Talks ("Mark my words.")           |
| Brock   | Gym bro        | Talks ("Trust me, bro.")           |
| Pip     | Toddler        | Points, giggles, hugs the innocent |
| Biscuit | Dog            | Sniffs people and their lunches    |
| Linda   | Office manager | Talks ("I am filing a report.")    |
| Marcel  | Mime           | Acts it out without a word         |

## How to play

1. **Open today's case.** Tap the pinned "Who Farted? Case #…" post, then **START SNIFFING**. New players get a 30-second practice case first.
2. **Tap a suspect to read their clue.** Each clue also shows in plain words, and the lift lights up the area it talks about. Clues use the words printed on the lift: **LEFT / MIDDLE / RIGHT** and **BACK / FRONT**. Food clues use the lunch stickers (CHILI, BEANS, EGGS…).
3. **Mark the innocent.** When the clues prove someone did not do it, tap **✗ MARK INNOCENT**. These are only your notes. If the clues don't prove it yet, the suspect says "Prove it!"
4. **Guess the farter.** Tap **GUESS THE FARTER**. You get **one** guess per case.
5. **See the verdict.** Find out if you were right, read the confession, and see who the whole subreddit blamed. A wrong guess shows **how to solve it**, step by step.
6. **Share it.** **POST MY VERDICT** adds a spoiler-free comment with your time and streak.

### The week

| Days                | Difficulty                                               | Suspects |
| ------------------- | -------------------------------------------------------- | -------- |
| Monday, Tuesday     | Easy                                                     | 4        |
| Wednesday to Friday | Medium, lunch facts needed                               | 6        |
| Saturday, Sunday    | Hard: **the farter lies**, everyone else tells the truth | 6        |

### Streaks and badges

Guess right on days in a row to build a streak. Your title shows as flair next to your name in the subreddit:

Sniffer → Rookie Sniffer (1 day) → Detective (3) → Senior Sniffer (7) → Chief Inspector (14) → Legendary Nose (30)

## How it works

- **Puzzles from the date.** Each case is generated from its date, so every player gets the same case and no puzzle list is stored. The generator checks every possible world (who farted, who ate what) and keeps a case only if all the clues together leave exactly one answer, no single clue solves it, and the number of clues needed fits the day's difficulty. Each suspect is the farter exactly once every six days.
- **Daily posts.** A scheduled job (`devvit.json` → `scheduler`) creates and pins each day's post and unpins yesterday's. Each post stores its own date, so old cases stay playable.
- **Community data.** Redis stores one guess per player per case, the blame count per suspect, and each player's streak. Streak titles are set with user flair.
- **Art.** All six characters are drawn as SVG in code (`src/shared/art.ts`), with six moods each. There are no image files in the game.

## Project layout

```
src/client   React 19 + Tailwind 4 web views
  splash.tsx   the feed card (inline post)
  game.tsx     the full game (expanded view)
src/server   Hono server: API, daily scheduler, menu action, install trigger
src/shared   puzzle generator, solver, wording, art, badges (used by both)
scripts      case preview, local preview, branding renderer
branding     subreddit icon, banners, pinned post text
```

## Running it

Needs Node 22 and a Reddit developer account.

```bash
npm install
npm run login        # log the Devvit CLI in to Reddit
npm run dev          # playtest in the private test subreddit
npm run test:unit    # fairness tests over 90 days of cases
npm run preview:cases -- 2026-11-25 7   # print upcoming cases with answers
```

Moderators of the private test subreddit get a test bar to replay a case or jump to another day. It never appears in the public subreddit.

A moderator can also post a case by hand from the subreddit menu: **Post today's Who Farted? case**.
