# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import copy

import pytest

from .. import data
from .. import tpnfile


PROJECT_DATA = {
    "Arch": {
        "name": "Arch",
        "version": "1.0.3",
        "license": "Some license.\n\nHopefully it's a nice one.",
        "url": "https://someplace.com/on/the/internet",
    },
    "Python programming language": {
        "name": "Python programming language",
        "version": "3.6.5",
        "license": "The PSF license.\n\nIt\nis\nvery\nlong!",
        "url": "https://python.org",
    },
}

EXAMPLE = """A header!

With legal stuff!


1. Arch 1.0.3 (https://someplace.com/on/the/internet)
2. Python programming language 3.6.5 (https://python.org)


%% Arch 1.0.3 NOTICES AND INFORMATION BEGIN HERE (https://someplace.com/on/the/internet)
=========================================
Some license.

Hopefully it's a nice one.
=========================================
END OF Arch NOTICES AND INFORMATION

%% Python programming language 3.6.5 NOTICES AND INFORMATION BEGIN HERE (https://python.org)
=========================================
The PSF license.

It
is
very
long!
=========================================
END OF Python programming language NOTICES AND INFORMATION
"""


@pytest.fixture
def example_data():
    return {
        name: data.Project(**project_data)
        for name, project_data in PROJECT_DATA.items()
    }


def test_parse_tpn(example_data):
    licenses = tpnfile.parse_tpn(EXAMPLE)
    assert "Arch" in licenses
    assert licenses["Arch"] == example_data["Arch"]
    assert "Python programming language" in licenses
    assert (
        licenses["Python programming language"]
        == example_data["Python programming language"]
    )


def test_sort(example_data):
    cached_data = copy.deepcopy(example_data)
    requested_data = copy.deepcopy(example_data)
    for details in requested_data.values():
        details.license = None
    cached_data["Python programming language"].version = "1.5.2"
    projects = tpnfile.sort(cached_data, requested_data)
    assert not cached_data
    assert len(requested_data) == 1
    assert "Python programming language" in requested_data
    assert requested_data["Python programming language"].version == "3.6.5"
    assert len(projects) == 1
    assert "Arch" in projects
    assert projects["Arch"].license is not None
    assert projects["Arch"].license == PROJECT_DATA["Arch"]["license"]


def test_generate_tpn(example_data):
    settings = {"metadata": {"header": "A header!\n\nWith legal stuff!"}}

    assert tpnfile.generate_tpn(settings, example_data) == EXAMPLE
