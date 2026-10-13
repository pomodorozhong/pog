# Docs

- [architecture.md](architecture.md): goal, decisions, how the app works, what the game data taught us, risks. Status and order live in [GitHub milestones](https://github.com/pomodorozhong/route-of-grace/milestones) and issues.
- [progress/](progress/): what was built and learned, by date, with test results.
- [../scripts/extract/README.md](../scripts/extract/README.md): the game data extractor and its output.

## Git workflow

- `main` reads as one commit per PR. Never commit on `main` directly.
- Work happens on a branch from `main` (`<type>/<summary>`, for example `feat/ui-redesign`), with small step-by-step Conventional Commits.
- A branch lands through a PR, squash-merged into one commit on `main`.
- Push only when the player asks.
