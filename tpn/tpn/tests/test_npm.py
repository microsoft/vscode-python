# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import json

import pytest

from .. import data
from .. import npm


@pytest.mark.asyncio
async def test_projects():
    json_data = {
        "lockfileVersion": 1,
        "dependencies": {
            "append-buffer": {
                "version": "1.0.2",
                "resolved": "https://registry.npmjs.org/append-buffer/-/append-buffer-1.0.2.tgz",
                "integrity": "sha1-2CIM9GYIFSXv6lBhTz3mUU36WPE=",
                "dev": True,
                "requires": {"buffer-equal": "^1.0.0"},
            },
            "applicationinsights": {
                "version": "1.0.1",
                "resolved": "https://registry.npmjs.org/applicationinsights/-/applicationinsights-1.0.1.tgz",
                "integrity": "sha1-U0Rrgw/o1dYZ7uKieLMdPSUDCSc=",
                "requires": {
                    "diagnostic-channel": "0.2.0",
                    "diagnostic-channel-publishers": "0.2.1",
                    "zone.js": "0.7.6",
                },
            },
            "arch": {
                "version": "2.1.0",
                "resolved": "https://registry.npmjs.org/arch/-/arch-2.1.0.tgz",
                "integrity": "sha1-NhOqRhSQZLPB8GB5Gb8dR4boKIk=",
            },
            "archy": {
                "version": "1.0.0",
                "resolved": "https://registry.npmjs.org/archy/-/archy-1.0.0.tgz",
                "integrity": "sha1-+cjBN1fMHde8N5rHeyxipcKGjEA=",
                "dev": True,
            },
            "argparse": {
                "version": "1.0.10",
                "resolved": "https://registry.npmjs.org/argparse/-/argparse-1.0.10.tgz",
                "integrity": "sha512-o5Roy6tNG4SL/FOkCAN6RzjiakZS25RLYFrcMttJqbdd8BWrnA+fGz57iN5Pb06pvBGvl5gQ0B48dJlslXvoTg==",
                "dev": True,
                "requires": {"sprintf-js": "~1.0.2"},
            },
        },
    }
    packages = await npm.projects_from_data(json.dumps(json_data))
    assert len(packages) == 2
    assert "arch" in packages
    assert packages["arch"] == data.Project(
        name="arch",
        version="2.1.0",
        url="https://registry.npmjs.org/arch/-/arch-2.1.0.tgz",
    )
    assert "applicationinsights" in packages
    assert packages["applicationinsights"] == data.Project(
        name="applicationinsights",
        version="1.0.1",
        url="https://registry.npmjs.org/applicationinsights/-/applicationinsights-1.0.1.tgz",
    )

    modified_data = json_data.copy()
    del modified_data["lockfileVersion"]
    with pytest.raises(ValueError):
        await npm.projects_from_data(json.dumps(modified_data))

    modified_data = json_data.copy()
    modified_data["lockfileVersion"] = 0
    with pytest.raises(ValueError):
        await npm.projects_from_data(json.dumps(modified_data))


def test_top_level_package_filenames():
    example = [
        "package/package.json",
        "package/index.js",
        "package/license",
        "package/readme.md",
        "package/code/stuff.js",
        "i_do_not_know.txt",
    ]
    package_filenames = npm._top_level_package_filenames(example)
    assert package_filenames == {"package.json", "index.js", "license", "readme.md"}


def test_find_license():
    example = {"package.json", "index.js", "license", "readme.md", "code/stuff.js"}
    assert "license" == npm._find_license(example)
    with pytest.raises(ValueError):
        npm._find_license([])


@pytest.mark.asyncio
async def test_fill_in_licenses():
    project = data.Project(
        "user-home",
        "2.0.0",
        "https://registry.npmjs.org/user-home/-/user-home-2.0.0.tgz",
    )
    example = {"user-home": project}
    failures = await npm.fill_in_licenses(example)
    assert not failures
    assert example["user-home"].license is not None
