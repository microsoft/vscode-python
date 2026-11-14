# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os
import pathlib
import sys
import tempfile

import pytest

from .helpers import (
    TEST_DATA_PATH,
)

script_dir = pathlib.Path(__file__).parent.parent.parent
sys.path.append(os.fspath(script_dir))
from vscode_pytest import (  # noqa: E402
    cached_fsdecode,
    has_symlink_parent,
    remove_xdist_group_suffix,
)


def test_has_symlink_parent_with_symlink():
    # Create a temporary directory and a file in it
    with tempfile.TemporaryDirectory() as temp_dir:
        file_path = pathlib.Path(temp_dir) / "file"
        file_path.touch()

        # Create a symbolic link to the temporary directory
        symlink_path = pathlib.Path(temp_dir) / "symlink"
        symlink_path.symlink_to(temp_dir)

        # Check that has_symlink_parent correctly identifies the symbolic link
        assert has_symlink_parent(symlink_path / "file")


def test_has_symlink_parent_without_symlink():
    folder_path = TEST_DATA_PATH / "unittest_folder" / "test_add.py"
    # Check that has_symlink_parent correctly identifies that there are no symbolic links
    assert not has_symlink_parent(folder_path)


def test_cached_fsdecode():
    """Test that cached_fsdecode correctly caches path-to-string conversions."""
    # Create a test path
    test_path = TEST_DATA_PATH / "simple_pytest.py"

    # First call should compute and cache
    result1 = cached_fsdecode(test_path)
    assert result1 == os.fspath(test_path)
    assert isinstance(result1, str)

    # Second call should return cached value (same object)
    result2 = cached_fsdecode(test_path)
    assert result2 == result1
    assert result2 is result1  # Should be the same object from cache

    # Different path should be cached independently
    test_path2 = TEST_DATA_PATH / "parametrize_tests.py"
    result3 = cached_fsdecode(test_path2)
    assert result3 == os.fspath(test_path2)
    assert result3 != result1


@pytest.mark.parametrize(
    ("test_id", "keywords", "expected"),
    [
        ("test_file.py::test_a@group_a", {"xdist_group": 1}, "test_file.py::test_a"),
        (
            "test_file.py::TestClass::test_a@group_a",
            {"xdist_group": 1},
            "test_file.py::TestClass::test_a",
        ),
        ("test_file.py::test_a[x@y]@group_a", {"xdist_group": 1}, "test_file.py::test_a[x@y]"),
        # Without --dist=loadgroup there is no suffix, but parameter ids can still contain "@".
        ("test_file.py::test_a[x@y]", {"xdist_group": 1}, "test_file.py::test_a[x@y]"),
        ("test_file.py::test_a", {"xdist_group": 1}, "test_file.py::test_a"),
        # Tests without the xdist_group marker are left untouched.
        ("test_file.py::test_a@group_a", {}, "test_file.py::test_a@group_a"),
    ],
)
def test_remove_xdist_group_suffix(test_id, keywords, expected):
    assert remove_xdist_group_suffix(test_id, keywords) == expected
