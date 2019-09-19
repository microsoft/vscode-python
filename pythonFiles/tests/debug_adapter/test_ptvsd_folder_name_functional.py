# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import pytest
import subprocess
import sys

from os import path
from packaging.requirements import Requirement


ROOT = path.dirname(path.dirname(path.dirname(path.dirname(path.abspath(__file__)))))
PYTHONFILES_ROOT = path.join(ROOT, "pythonFiles")
PYTHONFILES = path.join(PYTHONFILES_ROOT, "lib", "python")
REQUIREMENTS = path.join(ROOT, "requirements.txt")
ARGV = ["python3", path.join(PYTHONFILES_ROOT, "ptvsd_folder_name.py")]


def isPython37():
    return sys.version_info.major == 3 and sys.version_info.minor == 7


@pytest.mark.skipif(not isPython37(), reason="PTVSD wheels shipped for Python 3.7 only")
@pytest.mark.functional
class TestPtvsdFolderNameFunctional(object):
    """Functional tests for the script retrieving the PTVSD folder name for the PTVSD wheels experiment."""

    @classmethod
    def setup_class(cls):
        cls.version = cls.ptvsd_version()

    def ptvsd_version():
        with open(REQUIREMENTS, "r", encoding="utf-8") as reqsfile:
            for line in reqsfile:
                pkgreq = Requirement(line)
                if pkgreq.name == "ptvsd":
                    specs = pkgreq.specifier
                    return next(iter(specs)).version

    def ptvsd_paths(self, platforms=[]):
        paths = set()
        for platform in platforms:
            folder = "ptvsd-{0}-cp37-cp37m-{1}".format(self.version, platform)
            paths.add(path.join(PYTHONFILES, folder))
        return paths

    def test_ptvsd_folder_name_nofail(self):
        output = subprocess.check_output(ARGV, universal_newlines=True)
        assert output != PYTHONFILES

    @pytest.mark.skipif(sys.platform != "darwin", reason="macOS functional test")
    def test_ptvsd_folder_name_macos(self):
        output = subprocess.check_output(ARGV, universal_newlines=True)
        platform = ["macosx_10_13_x86_64"]
        assert output in self.ptvsd_paths(platform)

    @pytest.mark.skipif(sys.platform != "win32", reason="Windows functional test")
    def test_ptvsd_folder_name_windows(self):
        output = subprocess.check_output(ARGV, universal_newlines=True)
        assert output in self.ptvsd_paths(["win32", "win_amd64"])

    @pytest.mark.skipif(sys.platform != "linux", reason="Linux functional test")
    def test_ptvsd_folder_name_linux(self):
        output = subprocess.check_output(ARGV, universal_newlines=True)
        assert output in self.ptvsd_paths(
            ["manylinux1_i686", "manylinux1_x86_64", "manylinux2010_x86_64"]
        )
