# Rule — sprint workflow

How work moves through this project. Applies to board data, board UI, and any
feature that touches lists, cards, or statuses.

```
BACKLOG                    every task lands here, unordered
   │
   ▼
SPRINT PLANNING            pick a subset for this sprint
   │
   ▼
SPRINT BOARD               To Do → In Progress → Done
   │
   ▼
SPRINT END                 Done = complete; anything unfinished
                           returns to BACKLOG
```

## The model

Two containers, not one board.

| Container | Holds | Lists |
| --- | --- | --- |
| **Backlog** | every task not committed to a sprint | one flat list |
| **Sprint board** | only tasks pulled in during planning | `To Do`, `In Progress`, `Done` |

A task is in exactly one of them. Planning **moves** it backlog → sprint;
sprint close **moves** unfinished work back.

## Rules

- **The sprint board is not the backlog.** Never render every task on the
  sprint board. If a screen shows uncommitted work next to in-flight work, the
  model is wrong.
- **A sprint board's columns are the project's statuses — not fixed.**
  Decided 2026-09-16: teams add steps like `Review` or `QA` as statuses, and
  each becomes a column. Every status still belongs to one of three groups
  (To-do / In Progress / Complete), which is what completion and point
  roll-ups read — so never branch on a status NAME, only on its group.
- **Sprint close is a real operation**, not a filter. It marks `Done` tasks
  complete and returns the rest to the backlog. Model it as one action.
- **A card carries its origin.** Returning to the backlog must not lose the
  task's history, comments, or labels.
- **Status lives on the list, not the card.** A card's position *is* its
  status; don't also store a status field that can disagree with it.

## What this means for the code

- `Board` needs a `kind: "backlog" | "sprint"`. `BoardList` tone maps to the
  three sprint statuses.
- Fixtures in `src/lib/boards.ts` should show both containers, not one board
  with four arbitrary lists.
- Planning (pull into sprint) and close (return leftovers) are Server Actions
  in `src/lib/actions/`, each moving cards between containers.
- Sprint needs an identity — number, name, start/end date — before close can
  mean anything.

## Not yet decided

Sprint length · whether a sprint can be reopened · whether Done tasks archive
or stay visible · estimates/points. Ask before assuming any of these.
