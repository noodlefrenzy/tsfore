# agent-notes: { ctx: "shared pytest helpers: skip when a fetched-only snapshot is absent", deps: [src/tsfore/datasets.py], state: active, last: "tara@2026-10-18", key: ["restricted series are gitignored; run `uv run tsfore data fetch` to enable their tests"] }
import pytest

from tsfore.datasets import DATA_DIR, FINANCE


def requires_snapshot(*dataset_ids: str) -> None:
    """Skip unless every snapshot is on disk. Restricted series are never committed, so a
    fresh clone skips their tests rather than hitting the network."""
    for i in dataset_ids:
        spec = FINANCE[i]
        if not (DATA_DIR / f"{spec.derived_from or spec.id}.csv").exists():
            pytest.skip(f"{i} is fetched on use, not committed; run `uv run tsfore data fetch`")
