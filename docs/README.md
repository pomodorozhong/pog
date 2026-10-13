# Docs

- [architecture.md](architecture.md): goal, decisions, how the app works, what the game data taught us, risks. Status and order live in [GitHub milestones](https://github.com/pomodorozhong/route-of-grace/milestones) and issues.
- [progress/](progress/): what was built and learned, by date, with test results (up to 2026-10-13; later work is recorded in PRs and issues).
- [../scripts/extract/README.md](../scripts/extract/README.md): the game data extractor and its output.

## Git workflow

- `main` reads as one commit per PR. Never commit on `main` directly.
- Work starts from a GitHub issue. `.agents/next-steps.md` ranks the open issues; the issue holds the context.
- Work happens on a branch from `main` (`<type>/<summary>`, for example `feat/side-panel-tabs`; no issue number, since the PR links the issue), with small step-by-step Conventional Commits.
- A branch lands through a PR that says `Closes #<issue>`, squash-merged into one commit on `main`. Half-finished work is pushed as a draft PR.
- Use `Refs #<issue>` in commit messages for partial work or a decision about an issue that remains open. Closing keywords next to an issue number can close it when the commit reaches `main`, including through the combined commit messages in a squash merge.
- Push only when the player asks.
