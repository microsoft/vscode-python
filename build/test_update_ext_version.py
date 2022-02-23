# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import json
import pathlib
import pytest

from update_ext_version import main as update_version, parse_version


@pytest.fixture
def directory(tmpdir):
    """Fixture to create a temp directory wrapped in a pathlib.Path object."""
    return pathlib.Path(tmpdir)


@pytest.mark.parametrize(
    "version, args", [("1.1.0-rc", ["--release"]), ("1.0.0-rc", [])]
)
def test_minor_version(directory, version, args):
    package_json = directory / "package.json"
    package_json.write_text(json.dumps({"version": version}), encoding="utf-8")
    with pytest.raises(ValueError):
        update_version(package_json, args)


@pytest.mark.parametrize(
    "version, args",
    [
        ("1.0.0-rc", ["--release", "--build-id", "-1"]),
        ("1.0.0-rc", ["--release", "--for-publishing", "--build-id", "-1"]),
        ("1.0.0-rc", ["--release", "--for-publishing", "--build-id", "999999999999"]),
        ("1.1.0-rc", ["--build-id", "-1"]),
        ("1.1.0-rc", ["--for-publishing", "--build-id", "-1"]),
        ("1.1.0-rc", ["--for-publishing", "--build-id", "999999999999"]),
    ],
)
def test_invalid_build_id(directory, version, args):
    package_json = directory / "package.json"
    package_json.write_text(json.dumps({"version": version}), encoding="utf-8")
    with pytest.raises(ValueError):
        update_version(package_json, args)


@pytest.mark.parametrize(
    "version, args, expected",
    [
        ("1.1.0-rc", [], ("1", "1", "Not 0", "rc")),
        ("1.0.0-rc", ["--release"], ("1", "0", "0", "")),
        ("1.1.0-rc", ["--for-publishing"], ("1", "1", "Not 0", "")),
        ("1.0.0-rc", ["--release", "--for-publishing"], ("1", "0", "0", "")),
    ],
)
def test_updated_version(directory, version, args, expected):
    package_json = directory / "package.json"
    package_json.write_text(json.dumps({"version": version}), encoding="utf-8")
    update_version(package_json, args)
    package = json.loads(package_json.read_text(encoding="utf-8"))
    major, minor, micro, suffix = parse_version(package["version"])
    actual = (major, minor, "0" if micro == "0" else "Not 0", suffix)
    assert actual == expected


@pytest.mark.parametrize(
    "version, args, expected",
    [
        ("1.1.0-rc", ["--build-id", "12345"], ("1", "1", "12345", "rc")),
        ("1.0.0-rc", ["--release", "--build-id", "12345"], ("1", "0", "12345", "")),
        (
            "1.1.0-rc",
            ["--for-publishing", "--build-id", "12345"],
            ("1", "1", "12345", ""),
        ),
        (
            "1.0.0-rc",
            ["--release", "--for-publishing", "--build-id", "12345"],
            ("1", "0", "12345", ""),
        ),
        (
            "1.0.0-rc",
            ["--release", "--build-id", "999999999999"],
            ("1", "0", "999999999999", ""),
        ),
        (
            "1.1.0-rc",
            ["--build-id", "999999999999"],
            ("1", "1", "999999999999", "rc"),
        ),
    ],
)
def test_with_build_id(directory, version, args, expected):
    package_json = directory / "package.json"
    package_json.write_text(json.dumps({"version": version}), encoding="utf-8")
    update_version(package_json, args)
    package = json.loads(package_json.read_text(encoding="utf-8"))
    actual = parse_version(package["version"])
    assert actual == expected
