# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import json

import freezegun
import pytest
import update_ext_version

TEST_DATETIME = "2022-03-14 01:23:45"
EXPECTED_BUILD_ID = "10730123"
"""Calculated like this:
   `"1" + datetime.datetime.strptime(TEST_DATETIME,"%Y-%m-%d %H:%M:%S").strftime('%j%H%M')`
"""


def create_package_json(directory, version):
    """Create `package.json` in `directory` with a specified version of `version`."""
    package_json = directory / "package.json"
    package_json.write_text(json.dumps({"version": version}), encoding="utf-8")
    return package_json


@pytest.mark.parametrize(
    "version, args", [("1.1.0-rc", ["--release"]), ("1.0.0-rc", [])]
)
def test_minor_version(tmp_path, version, args):
    package_json = create_package_json(tmp_path, version)
    with pytest.raises(ValueError):
        update_ext_version.main(package_json, args)


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
def test_invalid_build_id(tmp_path, version, args):
    package_json = create_package_json(tmp_path, version)
    with pytest.raises(ValueError):
        update_ext_version.main(package_json, args)


@pytest.mark.parametrize(
    "version, args, expected",
    [
        ("1.1.0-rc", [], ("1", "1", "Not 0", "rc")),
        ("1.0.0-rc", ["--release"], ("1", "0", "0", "")),
        ("1.1.0-rc", ["--for-publishing"], ("1", "1", "Not 0", "")),
        ("1.0.0-rc", ["--release", "--for-publishing"], ("1", "0", "0", "")),
    ],
)
def test_updated_version(tmp_path, version, args, expected):
    package_json = create_package_json(tmp_path, version)
    update_ext_version.main(package_json, args)
    package = json.loads(package_json.read_text(encoding="utf-8"))
    major, minor, micro, suffix = update_ext_version.parse_version(package["version"])
    actual = major, minor, "0" if micro == "0" else "Not 0", suffix
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
def test_with_build_id(tmp_path, version, args, expected):
    package_json = create_package_json(tmp_path, version)
    update_ext_version.main(package_json, args)
    package = json.loads(package_json.read_text(encoding="utf-8"))
    actual = update_ext_version.parse_version(package["version"])
    assert actual == expected


@pytest.mark.parametrize(
    "version, args, expected",
    [
        ("1.1.0-rc", [], ("1", "1", EXPECTED_BUILD_ID, "rc")),
        (
            "1.0.0-rc",
            ["--release"],
            ("1", "0", "0", ""),
        ),
        (
            "1.1.0-rc",
            ["--for-publishing"],
            ("1", "1", EXPECTED_BUILD_ID, ""),
        ),
        (
            "1.0.0-rc",
            ["--release", "--for-publishing"],
            ("1", "0", "0", ""),
        ),
        (
            "1.0.0-rc",
            ["--release"],
            ("1", "0", "0", ""),
        ),
        (
            "1.1.0-rc",
            [],
            ("1", "1", EXPECTED_BUILD_ID, "rc"),
        ),
    ],
)
@freezegun.freeze_time("2022-03-14 01:23:45")
def test_without_build_id(tmp_path, version, args, expected):
    package_json = create_package_json(tmp_path, version)
    update_ext_version.main(package_json, args)
    package = json.loads(package_json.read_text(encoding="utf-8"))
    actual = update_ext_version.parse_version(package["version"])
    assert actual == expected
