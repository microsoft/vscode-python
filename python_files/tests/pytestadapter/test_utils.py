# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import ast
import os
import pathlib
import sys
import tempfile

from .helpers import (
    TEST_DATA_PATH,
)

script_dir = pathlib.Path(__file__).parent.parent.parent
sys.path.append(os.fspath(script_dir))
from vscode_pytest import (  # noqa: E402
    _CLASS_LINENO_CACHE,
    _ClassFinder,
    cached_fsdecode,
    create_class_node,
    has_symlink_parent,
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


def test_class_finder_extracts_class_lines():
    code = """
class SimpleClass:
    pass

class OuterClass:
    class InnerClass:
        pass

@some_decorator
class DecoratedClass:
    pass

def describe_block():
    def describe_nested():
        pass
"""
    tree = ast.parse(code)
    finder = _ClassFinder()
    finder.visit(tree)
    assert finder.classes["SimpleClass"] == 2
    assert finder.classes["OuterClass"] == 5
    assert finder.classes["OuterClass.InnerClass"] == 6
    assert finder.classes["DecoratedClass"] == 9
    assert finder.classes["describe_block"] == 13
    assert finder.classes["describe_block.<locals>.describe_nested"] == 14


def test_create_class_node_uses_firstlineno():
    class DummyObj:
        __firstlineno__ = 42

    class DummyClassModule:
        name = "DummyClass"
        nodeid = "test_file.py::DummyClass"
        obj = DummyObj()
        path = pathlib.Path("test_file.py")

    node = create_class_node(DummyClassModule())
    assert node["lineno"] == "42"


def test_create_class_node_caches_ast_by_file(tmp_path):
    test_file = tmp_path / "test_sample.py"
    test_file.write_text("class TestOne:\n    pass\n\nclass TestTwo:\n    pass\n")

    class TestOne:
        pass

    class TestTwo:
        pass

    TestOne.__qualname__ = "TestOne"
    TestTwo.__qualname__ = "TestTwo"

    class DummyClass1:
        name = "TestOne"
        nodeid = f"{test_file}::TestOne"
        obj = TestOne
        path = test_file

    class DummyClass2:
        name = "TestTwo"
        nodeid = f"{test_file}::TestTwo"
        obj = TestTwo
        path = test_file

    # Remove __firstlineno__ if present to exercise AST caching path
    if hasattr(TestOne, "__firstlineno__"):
        delattr(TestOne, "__firstlineno__")
    if hasattr(TestTwo, "__firstlineno__"):
        delattr(TestTwo, "__firstlineno__")

    node1 = create_class_node(DummyClass1())
    assert node1["lineno"] == "1"
    assert test_file in _CLASS_LINENO_CACHE

    node2 = create_class_node(DummyClass2())
    assert node2["lineno"] == "4"
