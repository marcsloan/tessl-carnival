# Ring Toss

Land your rings on the necks of the bottles at the back of the booth.

## How to play

- Move the mouse to aim, and click to throw a ring. The crosshair shows where a
  ring thrown now would land.
- Your hand sways from side to side, up to 40 px either way, so time the throw.
- One ring flies at a time. A ring scores when it lands on a bottle neck.
- You have 10 rings. The round ends when the last ring has landed.
- Click again on the game over screen to play another round.

## Scoring

Bottles stand in three rows of five. Bottles further back are smaller and score more:

| Row    | Points |
| ------ | ------ |
| Back   | 30     |
| Middle | 20     |
| Front  | 10     |

Your final score is saved to the carnival's score board when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `throwRing`, `step`, `bottleAt`,
  `swayAt`) and the `ringToss` entry, the default export the midway finds.
- `game.test.ts`: tests for the game logic.
