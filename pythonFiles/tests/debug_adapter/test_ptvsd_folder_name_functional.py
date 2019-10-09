# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import sys

if sys.version_info[:2] != (3, 7):
    import unittest

    raise unittest.SkipTest("PTVSD wheels shipped for Python 3.7 only")

import os.path
import pytest
import subprocess

from packaging.requirements import Requirement
from .. import PYTHONFILES, SRC_ROOT

ARGV = ["python", os.path.join(SRC_ROOT, "ptvsd_folder_name.py")]


def ptvsd_paths(*platforms):
    paths = set()
    for platform in platforms:
        folder = "ptvsd-cp37-cp37m-{}".format(platform)
        paths.add(os.path.join(PYTHONFILES, folder))
    return paths


@pytest.mark.functional
class TestPtvsdFolderNameFunctional:
    """Functional tests for the script retrieving the PTVSD folder name for the PTVSD wheels experiment."""

    def test_ptvsd_folder_name_nofail(self):
        output = subprocess.check_output(ARGV, universal_newlines=True)
        assert output != PYTHONFILES

    @pytest.mark.skipif(sys.platform != "darwin", reason="macOS functional test")
    def test_ptvsd_folder_name_macos(self):
        output = subprocess.check_output(ARGV, universal_newlines=True)
        assert output in ptvsd_paths("macosx_10_13_x86_64")

    @pytest.mark.skipif(sys.platform != "win32", reason="Windows functional test")
    def test_ptvsd_folder_name_windows(self):
        output = subprocess.check_output(ARGV, universal_newlines=True)
        assert output in ptvsd_paths("win32", "win_amd64")

    @pytest.mark.skipif(sys.platform != "linux", reason="Linux functional test")
    def test_ptvsd_folder_name_linux(self):
        output = subprocess.check_output(ARGV, universal_newlines=True)
        assert output in ptvsd_paths(
            "manylinux1_i686", "manylinux1_x86_64", "manylinux2010_x86_64"
        )
