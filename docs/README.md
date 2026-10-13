# Docs

- [plan.md](plan.md): goal, decisions, design, build order with each milestone's status, risks.
- [progress/](progress/): what was built and learned, by date, with test results.
- [../scripts/extract/README.md](../scripts/extract/README.md): the game data extractor and its output.

## Git workflow

- `main` reads as one commit per PR. Never commit on `main` directly.
- Work happens on a branch from `main` (`<type>/<summary>`, for example `feat/ui-redesign`), with small step-by-step Conventional Commits.
- A branch lands through a PR, squash-merged into one commit on `main`.
- Push only when the player asks.
