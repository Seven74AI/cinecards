# Simulation report (story 4.5)

`packages/engine/src/simulate.test.ts` plays 200 games between two random bots
(`botStep` in `packages/engine/src/bot.ts`) with the 51 MVP cards.

| Metric | Value |
|---|---|
| Games | 200 (100 shared pile, 100 random split) |
| Finished with a winner | 200 / 200 |
| Wins first player / second player | 105 / 95 |
| Average turns (both players) | 30 |
| Longest game | 73 turns |
| Crashes / stuck games | 0 |

The random bot is much worse than a human (it often attacks badly and ends turns early),
so real games should be shorter. The first-player advantage looks small (52.5 %).

## Story 11.6 — abilities re-encoded (2026-11-22)

Same 200 seeds and bot policy (`pnpm test`, `simulate.test.ts`). "Before" is the engine of stories
11.4 and 11.5 (triggers, prompts answered by the bot, 0 to N targets) with the old card data;
"after" adds the re-encoded cards (arrival effects instead of repeatable actives, attack abilities,
Benson's bonus for one turn, single-use Sentinels).

| Metric | Story 4.5 | Before 11.6 | After 11.6 |
|---|---|---|---|
| Finished with a winner | 200 / 200 | 200 / 200 | 200 / 200 |
| Wins first / second player | 105 / 95 | 108 / 92 | 101 / 99 |
| Average turns (both players) | 30 | 28.1 | 28.5 |
| Average actions per game | — | 138 | 127 |
| Longest game | 73 turns | 60 turns | 77 turns |
| Crashes / stuck games | 0 | 0 | 0 |

Average game length barely moves (+0.4 turn): the random bot rarely chained the repeatable
actives that made playtest 1 games run away, so the main effect shows up as fewer actions per
game (−8 %), not as shorter games. A human playtest is still the real check.
