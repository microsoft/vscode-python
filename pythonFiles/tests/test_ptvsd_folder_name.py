# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import pytest
from os import path
from packaging.tags import sys_tags
from unittest.mock import patch, mock_open

from pythonFiles.ptvsd_folder_name import ptvsd_folder_name

ROOT = path.dirname(path.dirname(path.dirname(path.abspath(__file__))))
PYTHONFILES = path.join(ROOT, "pythonFiles", "lib", "python")
REQUIREMENTS = path.join(path.dirname(path.abspath(__file__)), "ptvsd_folder_name")


def open_requirements_with_ptvsd():
    return patch(
        "pythonFiles.ptvsd_folder_name.open",
        mock_open(read_data="jedi==0.15.1\nptvsd==5.0.0"),
    )


def open_requirements_without_ptvsd():
    return patch(
        "pythonFiles.ptvsd_folder_name.open", mock_open(read_data="jedi==0.15.1\n")
    )


def mock_path_exists_true(pathname):
    return True


def mock_path_exists_false(pathname):
    return False


class TestPtvsdFolderName(object):
    """Unit tests for the script retrieving the PTVSD folder name for the PTVSD wheels experiment."""

    def test_requirement_exists_folder_exists(self, capsys, monkeypatch):
        monkeypatch.setattr(path, "exists", mock_path_exists_true)
        with open_requirements_with_ptvsd() as p:
            ptvsd_folder_name()
        tag = next(sys_tags())
        folder = f"ptvsd-5.0.0-{tag.interpreter}-{tag.abi}-{tag.platform}"
        expected = path.join(PYTHONFILES, folder)
        captured = capsys.readouterr()
        assert captured.out.strip() == expected

    def test_no_ptvsd_requirement(self, capsys):
        with open_requirements_without_ptvsd() as p:
            ptvsd_folder_name()
        expected = PYTHONFILES
        captured = capsys.readouterr()
        assert captured.out.strip() == expected

    def test_no_wheel_folder(self, capsys, monkeypatch):
        monkeypatch.setattr(path, "exists", mock_path_exists_false)
        with open_requirements_with_ptvsd() as p:
            ptvsd_folder_name()
        expected = PYTHONFILES
        captured = capsys.readouterr()
        assert captured.out.strip() == expected

