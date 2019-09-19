# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
import sys

if sys.version_info[:2] != (3, 7):
    import unittest

    raise unittest.SkipTest("PTVSD wheels shipped for Python 3.7 only")

import os.path
import pytest

try:
    from unittest.mock import patch, mock_open

    from packaging.tags import sys_tags
    from ptvsd_folder_name import ptvsd_folder_name
except:  # Python 2.7
    print("Not importing anything for Python 2.7 since the test will be skipped.")


ROOT = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)
PYTHONFILES = os.path.join(ROOT, "pythonFiles", "lib", "python")


def open_requirements_with_ptvsd():
    return patch(
        "ptvsd_folder_name.open", mock_open(read_data="jedi==0.15.1\nptvsd==5.0.0")
    )


def open_requirements_without_ptvsd():
    return patch("ptvsd_folder_name.open", mock_open(read_data="jedi==0.15.1\n"))


class TestPtvsdFolderName:
    """Unit tests for the script retrieving the PTVSD folder name for the PTVSD wheels experiment."""

    def test_requirement_exists_folder_exists(self, capsys, monkeypatch):
        # Return the first constructed folder path as existing.
        monkeypatch.setattr(path, "exists", lambda p: True)
        tag = next(sys_tags())
        folder = "ptvsd-5.0.0-{0}-{1}-{2}".format(
            tag.interpreter, tag.abi, tag.platform
        )

        with open_requirements_with_ptvsd():
            ptvsd_folder_name()

        expected = os.path.join(PYTHONFILES, folder)
        captured = capsys.readouterr()
        assert captured.out == expected

    def test_no_ptvsd_requirement(self, capsys):
        with open_requirements_without_ptvsd() as p:
            ptvsd_folder_name()

        expected = PYTHONFILES
        captured = capsys.readouterr()
        assert captured.out == expected

    def test_no_wheel_folder(self, capsys, monkeypatch):
        # Return none of of the constructed paths as existing,
        # ptvsd_folder_name() should return the path to default ptvsd.
        monkeypatch.setattr(path, "exists", lambda p: False)

        with open_requirements_with_ptvsd() as p:
            ptvsd_folder_name()

        expected = PYTHONFILES
        captured = capsys.readouterr()
        assert captured.out == expected

