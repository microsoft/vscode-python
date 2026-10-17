# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os
import pathlib
import sys
import tempfile

from .helpers import (
    TEST_DATA_PATH,
)

script_dir = pathlib.Path(__file__).parent.parent.parent
sys.path.append(os.fspath(script_dir))
from vscode_pytest import cached_fsdecode, has_symlink_parent  # noqa: E402


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


def test_hidden_param_discovery(tmp_path):
    """Test that parameterized test with pytest.HIDDEN_PARAM builds tree without error."""
    import pytest

    test_file = tmp_path / "test_hidden.py"
    test_file.write_text(
        "import pytest\n"
        "@pytest.mark.parametrize('setup', [pytest.param('setup', id=pytest.HIDDEN_PARAM)])\n"
        "def test_main(setup):\n"
        "    assert True\n"
    )

    class Collector:
        def __init__(self):
            self.tree = None

        def pytest_sessionfinish(self, session, exitstatus):
            from vscode_pytest import build_test_tree

            self.tree = build_test_tree(session)

    collector = Collector()
    pytest.main(["--collect-only", str(test_file)], plugins=[collector])
    assert collector.tree is not None
    file_nodes = list(collector.tree["children"].values())
    assert len(file_nodes) == 1
    file_node = file_nodes[0]
    assert file_node["name"] == "test_hidden.py"
    children = file_node["children"]
    test_nodes = list(children.values() if hasattr(children, "values") else children)
    assert len(test_nodes) == 1
    assert test_nodes[0]["name"] == "test_main"
    assert test_nodes[0]["type_"] == "test"
