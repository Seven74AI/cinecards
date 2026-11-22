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
