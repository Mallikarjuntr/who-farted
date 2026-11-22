# Who Farted?

A daily comedic whodunit for Reddit. Six suspects share a lift, someone farts, and you get **one guess** to find out who. A new case is posted and pinned every day at 00:00 UTC in [r/WhoFartedDaily](https://www.reddit.com/r/WhoFartedDaily/).

Built on [Devvit Web](https://developers.reddit.com/) for Reddit's Game of the Day hackathon.

## The suspects

| Suspect | Who they are   | How they give clues                                    |
| ------- | -------------- | ------------------------------------------------------ |
| Agnes   | Grandma        | Talks. Says what she saw. Starts with "Oh dear!"       |
| Brock   | Gym bro        | Talks. Calls everyone "bro".                           |
| Pip     | Toddler        | Can't talk yet. Points at the smell, hugs the innocent |
| Biscuit | Dog            | Can't talk. Sniffs people to find out what they ate    |
| Linda   | Office manager | Talks. Writes everything down. Very exact.             |
| Marcel  | Mime           | Never says a word. Acts out what he saw                |

New players meet these six on a "Meet the suspects" screen before the practice case. The same list is in the **?** rules.

## How to play

1. **Open today's case.** Tap the pinned "Who Farted? Case #…" post, then **START SNIFFING**. New players meet the suspects, then play a 1-minute practice case.
2. **Tap a suspect to read their clue.** Each clue is one short fact in plain words, like "Bro! The farter ate BEANS." Pip, Biscuit and Marcel can't talk, so they also act it out in one line. The lift lights up the area the clue talks about. Working out what it means is the puzzle.
   - Places are named after things you can see in the lift: the **BUTTONS** panel, the **MIDDLE**, the **MIRROR**, the **BACK** wall and the **DOORS**. Never "left" or "right", because the suspects face you, so their right is your left.
   - Food clues use the lunch stickers (CHILI, BEANS, EGGS…).
3. **Mark the innocent.** When the clues prove someone did not do it, tap **✗ MARK INNOCENT**. These are only your notes. If the clues don't prove it yet, the suspect says "Prove it!"
4. **Guess the farter.** Tap **GUESS THE FARTER**. You get **one** guess per case.
5. **See the verdict.** Find out if you were right, read the confession, and see who the whole subreddit blamed. A wrong guess shows **how to solve it**, step by step in plain words, and **why your pick was not the farter**.
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
