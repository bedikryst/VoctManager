"""Pure domain logic for the roster: rules that hold regardless of how a project
is stored, served or printed. Nothing here may import from ``infrastructure``,
DRF, or a template engine — the dependency runs the other way, so the same rule
can answer an API read-model and a PDF without either owning it."""
