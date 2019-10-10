# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
import sys

if sys.version_info[:2] != (3, 7):
    import unittest

    raise unittest.SkipTest("PTVSD wheels shipped for Python 3.7 only")

import os.path
import pytest
import re

from unittest.mock import patch, mock_open
from packaging.tags import sys_tags
from ptvsd_folder_name import ptvsd_folder_name

from .. import PYTHONFILES


class TestPtvsdFolderName:
    """Unit tests for the script retrieving the PTVSD folder name for the PTVSD wheels experiment."""

    def test_folder_exists(self, capsys):
        # Return the first constructed folder path as existing.

        patcher = patch("os.path.exists")
        mock_exists = patcher.start()
        mock_exists.side_effect = lambda p: True
        tag = next(sys_tags())
        folder = "ptvsd-{}-{}-{}".format(tag.interpreter, tag.abi, tag.platform)

        ptvsd_folder_name()

        patcher.stop()
        expected = os.path.join(PYTHONFILES, folder)
        captured = capsys.readouterr()
        assert captured.out == expected

    def test_no_wheel_folder(self, capsys):
        # Return none of of the constructed paths as existing,
        # ptvsd_folder_name() should return the path to default ptvsd.
        patcher = patch("os.path.exists")
        mock_no_exist = patcher.start()
        mock_no_exist.side_effect = lambda p: False

        ptvsd_folder_name()

        patcher.stop()
        expected = PYTHONFILES
        captured = capsys.readouterr()
        assert captured.out == expected

