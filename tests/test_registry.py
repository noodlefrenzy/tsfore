# agent-notes: { ctx: "tests for forecasters.build name registry, no torch needed", deps: [src/tsfore/forecasters/__init__.py], state: active, last: "claude@2026-10-17" }
import pytest

from tsfore.forecasters import build
from tsfore.forecasters.timestral import TimestralAdapter


def test_timestral_device_defaults_to_auto_and_build_passes_it_through():
    assert TimestralAdapter("mistralai/Timestral-5M").device == "auto"
    adapter = build("timestral-209m", season_length=1, device="cuda")
    assert adapter.name == "timestral-209m" and adapter.device == "cuda"


def test_build_maps_chronos_names_to_hub_checkpoints():
    from tsfore.forecasters.chronos import ChronosAdapter

    small = build("chronos-2-small", season_length=1, device="cuda")
    assert isinstance(small, ChronosAdapter)
    assert small.repo_id == "autogluon/chronos-2-small" and small.device == "cuda"
    assert build("chronos-2", season_length=1).repo_id == "amazon/chronos-2"


def test_build_rejects_unknown_names():
    with pytest.raises(ValueError, match="choose from"):
        build("prophet", season_length=1)
