# docs/

Three shelves. Which shelf a file sits on is the claim about whether it still binds you.

| Shelf | What is on it | How to treat it |
| --- | --- | --- |
| `docs/` (root) | Durable reference: operational runbooks and explainers of how a subsystem works **today** — backups, monitoring, error handling, web push, the archive AI ingestion pipeline, the identity model, the landing guardrails, the translation glossary. | Authoritative. If the code and one of these disagree, one of them is a bug. |
| `docs/specs/` | Work with something left to do. Each file opens with a `Status:` line or a `Still open` section. | Read the status before acting. A stage marked shipped is history; the rest is the plan. |
| `docs/archive/` | Finished work — closed, complete or superseded. | Read it to learn **why** an existing shape is the way it is. Never read it as a plan. |

A file moves from `specs/` to `archive/` when its last stage ships, or when a newer spec supersedes
it. Nothing is deleted for being old: the reasoning is the point, and re-deriving it costs more than
storing it.

Do not list or sweep this directory. Go to the one file the task names — `AGENTS.md` and
`.agent/memory/MEMORY.md` exist so you can pick it without looking.
