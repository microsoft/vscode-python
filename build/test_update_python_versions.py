# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import datetime

import pytest
import update_python_versions

NOW = datetime.datetime(2026, 8, 2, tzinfo=datetime.timezone.utc)
WORKFLOWS = ("pr-check.yml", "build.yml")


def release(name="Python 3.15.0rc1", release_date="2026-08-01T00:00:00Z", **overrides):
    result = {
        "name": name,
        "release_date": release_date,
        "is_published": True,
        "pre_release": True,
        "version": 3,
    }
    result.update(overrides)
    return result


def test_latest_release_candidate_filters_and_orders_releases():
    releases = [
        release("Python 3.9.0rc10"),
        release("Python 3.10.0rc2"),
        release("Python 3.11.0b1"),
        release("Python 3.11.0rc1", "2027-08-01T00:00:00Z"),
        release("Python 3.12.0rc1", is_published=False),
        release("Python 3.13.0rc1", pre_release=False),
        None,
    ]

    assert update_python_versions.latest_release_candidate(releases, NOW) == "3.10"


@pytest.mark.parametrize("release_date", [None, "invalid", "2026-08-01"])
def test_latest_release_candidate_rejects_malformed_dates(release_date):
    with pytest.raises(ValueError, match="release_date"):
        update_python_versions.latest_release_candidate(
            [release(release_date=release_date)], NOW
        )


def test_latest_release_candidate_requires_a_published_rc():
    with pytest.raises(ValueError, match="released Python RC"):
        update_python_versions.latest_release_candidate(
            [release("Python 3.15.0"), release("Python 3.16.0a1")], NOW
        )


@pytest.mark.parametrize("key", ["python", "python-version"])
def test_configured_versions_normalizes_explicit_series(tmp_path, key):
    workflow = tmp_path / "workflow.yml"
    workflow.write_text(
        f"{key}: ['3.10.9', '3.11-dev', '3.12.0rc1', '3.x']\n", encoding="utf-8"
    )

    assert update_python_versions.configured_versions(workflow) == {
        "3.10",
        "3.11",
        "3.12",
    }


@pytest.mark.parametrize("text", ["matrix: {}\n", "python: ['3.x']\n"])
def test_configured_versions_requires_explicit_matrices(tmp_path, text):
    workflow = tmp_path / "workflow.yml"
    workflow.write_text(text, encoding="utf-8")

    with pytest.raises(RuntimeError, match="Python version"):
        update_python_versions.configured_versions(workflow)


@pytest.mark.parametrize("key", ["python", "python-version"])
@pytest.mark.parametrize(
    "first, second, expected",
    [
        ("3.15", "3.14", set()),
        ("3.14", "3.15", set()),
        ("3.15.1", "3.15-dev", {"3.15"}),
    ],
)
def test_configured_versions_requires_coverage_in_each_matrix(
    tmp_path, key, first, second, expected
):
    workflow = tmp_path / "workflow.yml"
    workflow.write_text(
        f"{key}: ['{first}']\n{key}: ['{second}']\n{key}: ['3.x']\n",
        encoding="utf-8",
    )

    assert update_python_versions.configured_versions(workflow) == expected


@pytest.mark.parametrize(
    "pr_version, push_version, expected",
    [
        ("3.14", "3.14", "3.15"),
        ("3.15", "3.14", "3.15"),
        ("3.14", "3.15", "3.15"),
        ("3.15", "3.15", None),
        ("3.15.1", "3.15.0-rc.2", None),
        ("3.150", "3.15", "3.15"),
    ],
)
def test_unconfigured_version(tmp_path, pr_version, push_version, expected):
    workflows = [tmp_path / name for name in WORKFLOWS]
    for workflow, version in zip(workflows, (pr_version, push_version)):
        workflow.write_text(f"python: ['{version}']\n", encoding="utf-8")

    assert (
        update_python_versions.unconfigured_version([release()], workflows, NOW)
        == expected
    )


@pytest.mark.parametrize(
    "push_version, expected", [("3.14", "3.15\n"), ("3.15-dev", "")]
)
def test_main_checks_both_workflows(
    tmp_path, monkeypatch, capsys, push_version, expected
):
    workflow_dir = tmp_path / ".github" / "workflows"
    workflow_dir.mkdir(parents=True)
    for name, version in zip(WORKFLOWS, ("3.15.1", push_version)):
        (workflow_dir / name).write_text(f"python: ['{version}']\n", encoding="utf-8")
    monkeypatch.setattr(
        update_python_versions,
        "__file__",
        str(tmp_path / "build" / "update_python_versions.py"),
    )
    monkeypatch.setattr(
        update_python_versions,
        "fetch_releases",
        lambda: [release(release_date="2020-08-01T00:00:00Z")],
    )

    update_python_versions.main()

    assert capsys.readouterr().out == expected
