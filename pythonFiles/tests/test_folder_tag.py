# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import platform
import pytest

from folder_tag import get_folder_tag


@pytest.mark.parametrize(
    "os,arch,expected",
    [
        ("Darwin", 32, "mac-64"),
        ("Darwin", 64, "mac-64"),
        ("Windows", 32, "win-32"),
        ("Windows", 64, "win-64"),
        ("Linux", 64, "linux-64"),
        ("Linux", 32, "linux-32"),
        ("Anything", 64, "linux-64"),
    ],
)
def test_folder(monkeypatch, os, arch, expected):
    def mock_os():
        return os

    def mock_arch():
        return ("{}bit".format(arch), "")

    monkeypatch.setattr(platform, "system", mock_os)
    monkeypatch.setattr(platform, "architecture", mock_arch)
    assert get_folder_tag() == expected

