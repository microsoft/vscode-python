# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

TEST_SUBTRACT_FUNCTION = "unittest_folder/test_subtract.py::TestSubtractFunction::"
TEST_ADD_FUNCTION = "unittest_folder/test_add.py::TestAddFunction::"
SUCCESS = "success"
FAILURE = "failure"
TEST_SUBTRACT_FUNCTION_NEGATIVE_NUMBERS_ERROR = "self = <test_subtract.TestSubtractFunction testMethod=test_subtract_negative_numbers>\n\n    def test_subtract_negative_numbers(  # test_marker--test_subtract_negative_numbers\n        self,\n    ):\n        result = subtract(-2, -3)\n>       self.assertEqual(result, 100000)\nE       AssertionError: 1 != 100000\n\nunittest_folder/test_subtract.py:25: AssertionError"
from .helpers import TEST_DATA_PATH, get_absolute_test_id

# This is the expected output for the unittest_folder execute tests
# └── unittest_folder
#    ├── test_add.py
#    │   └── TestAddFunction
#    │       ├── test_add_negative_numbers: success
#    │       └── test_add_positive_numbers: success
#    └── test_subtract.py
#        └── TestSubtractFunction
#            ├── test_subtract_negative_numbers: failure
#            └── test_subtract_positive_numbers: success
test_add_path = TEST_DATA_PATH / "unittest_folder" / "test_add.py"
test_subtract_path = TEST_DATA_PATH / "unittest_folder" / "test_subtract.py"
uf_execution_expected_output = {
    get_absolute_test_id(
        f"{TEST_ADD_FUNCTION}test_add_negative_numbers", test_add_path
    ): {
        "test": get_absolute_test_id(
            f"{TEST_ADD_FUNCTION}test_add_negative_numbers", test_add_path
        ),
        "outcome": SUCCESS,
        "message": None,
        "traceback": None,
        "subtest": None,
    },
    get_absolute_test_id(
        f"{TEST_ADD_FUNCTION}test_add_positive_numbers", test_add_path
    ): {
        "test": get_absolute_test_id(
            f"{TEST_ADD_FUNCTION}test_add_positive_numbers", test_add_path
        ),
        "outcome": SUCCESS,
        "message": None,
        "traceback": None,
        "subtest": None,
    },
    get_absolute_test_id(
        f"{TEST_SUBTRACT_FUNCTION}test_subtract_negative_numbers",
        test_subtract_path,
    ): {
        "test": get_absolute_test_id(
            f"{TEST_SUBTRACT_FUNCTION}test_subtract_negative_numbers",
            test_subtract_path,
        ),
        "outcome": FAILURE,
        "message": "ERROR MESSAGE",
        "traceback": None,
        "subtest": None,
    },
    get_absolute_test_id(
        f"{TEST_SUBTRACT_FUNCTION}test_subtract_positive_numbers",
        test_subtract_path,
    ): {
        "test": get_absolute_test_id(
            f"{TEST_SUBTRACT_FUNCTION}test_subtract_positive_numbers",
            test_subtract_path,
        ),
        "outcome": SUCCESS,
        "message": None,
        "traceback": None,
        "subtest": None,
    },
}


# This is the expected output for the unittest_folder only execute add.py tests
# └── unittest_folder
#    ├── test_add.py
#    │   └── TestAddFunction
#    │       ├── test_add_negative_numbers: success
#    │       └── test_add_positive_numbers: success
test_add_path = TEST_DATA_PATH / "unittest_folder" / "test_add.py"

uf_single_file_expected_output = {
    get_absolute_test_id(
        f"{TEST_ADD_FUNCTION}test_add_negative_numbers", test_add_path
    ): {
        "test": get_absolute_test_id(
            f"{TEST_ADD_FUNCTION}test_add_negative_numbers", test_add_path
        ),
        "outcome": SUCCESS,
        "message": None,
        "traceback": None,
        "subtest": None,
    },
    get_absolute_test_id(
        f"{TEST_ADD_FUNCTION}test_add_positive_numbers", test_add_path
    ): {
        "test": get_absolute_test_id(
            f"{TEST_ADD_FUNCTION}test_add_positive_numbers", test_add_path
        ),
        "outcome": SUCCESS,
        "message": None,
        "traceback": None,
        "subtest": None,
    },
}


# This is the expected output for the unittest_folder execute only signle method
# └── unittest_folder
#    ├── test_add.py
#    │   └── TestAddFunction
#    │       └── test_add_positive_numbers: success
uf_single_method_execution_expected_output = {
    get_absolute_test_id(
        f"{TEST_ADD_FUNCTION}test_add_positive_numbers", test_add_path
    ): {
        "test": get_absolute_test_id(
            f"{TEST_ADD_FUNCTION}test_add_positive_numbers", test_add_path
        ),
        "outcome": SUCCESS,
        "message": None,
        "traceback": None,
        "subtest": None,
    },
}

# This is the expected output for the unittest_folder tests run where two tests
# run are in different files.
# └── unittest_folder
#    ├── test_add.py
#    │   └── TestAddFunction
#    │       └── test_add_positive_numbers: success
#    └── test_subtract.py
#        └── TestSubtractFunction
#            └── test_subtract_positive_numbers: success
test_subtract_path = TEST_DATA_PATH / "unittest_folder" / "test_subtract.py"
test_add_path = TEST_DATA_PATH / "unittest_folder" / "test_add.py"

uf_non_adjacent_tests_execution_expected_output = {
    get_absolute_test_id(
        f"{TEST_SUBTRACT_FUNCTION}test_subtract_positive_numbers", test_subtract_path
    ): {
        "test": get_absolute_test_id(
            f"{TEST_SUBTRACT_FUNCTION}test_subtract_positive_numbers",
            test_subtract_path,
        ),
        "outcome": SUCCESS,
        "message": None,
        "traceback": None,
        "subtest": None,
    },
    get_absolute_test_id(
        f"{TEST_ADD_FUNCTION}test_add_positive_numbers", test_add_path
    ): {
        "test": get_absolute_test_id(
            f"{TEST_ADD_FUNCTION}test_add_positive_numbers", test_add_path
        ),
        "outcome": SUCCESS,
        "message": None,
        "traceback": None,
        "subtest": None,
    },
}


# This is the expected output for the simple_pytest.py file.
# └── simple_pytest.py
#    └── test_function: success
simple_pytest_path = TEST_DATA_PATH / "unittest_folder" / "simple_pytest.py"

simple_execution_pytest_expected_output = {
    get_absolute_test_id("test_function", simple_pytest_path): {
        "test": get_absolute_test_id("test_function", simple_pytest_path),
        "outcome": "success",
        "message": None,
        "traceback": None,
        "subtest": None,
    }
}


# This is the expected output for the unittest_pytest_same_file.py file.
# ├── unittest_pytest_same_file.py
#   ├── TestExample
#   │   └── test_true_unittest: success
#   └── test_true_pytest: success
unit_pytest_same_file_path = TEST_DATA_PATH / "unittest_pytest_same_file.py"
unit_pytest_same_file_execution_expected_output = {
    get_absolute_test_id(
        "unittest_pytest_same_file.py::TestExample::test_true_unittest",
        unit_pytest_same_file_path,
    ): {
        "test": get_absolute_test_id(
            "unittest_pytest_same_file.py::TestExample::test_true_unittest",
            unit_pytest_same_file_path,
        ),
        "outcome": "success",
        "message": None,
        "traceback": None,
        "subtest": None,
    },
    get_absolute_test_id(
        "unittest_pytest_same_file.py::test_true_pytest", unit_pytest_same_file_path
    ): {
        "test": get_absolute_test_id(
            "unittest_pytest_same_file.py::test_true_pytest",
            unit_pytest_same_file_path,
        ),
        "outcome": "success",
        "message": None,
        "traceback": None,
        "subtest": None,
    },
}

# This is the expected output for the error_raised_exception.py file.
# └── error_raise_exception.py
#   ├── TestSomething
#   │   └── test_a: failure
error_raised_exception_path = TEST_DATA_PATH / "error_raise_exception.py"
error_raised_exception_execution_expected_output = {
    get_absolute_test_id(
        "error_raise_exception.py::TestSomething::test_a", error_raised_exception_path
    ): {
        "test": get_absolute_test_id(
            "error_raise_exception.py::TestSomething::test_a",
            error_raised_exception_path,
        ),
        "outcome": "error",
        "message": "ERROR MESSAGE",
        "traceback": "TRACEBACK",
        "subtest": None,
    }
}

# This is the expected output for the skip_tests.py file.
# └── test_something: success
# └── test_another_thing: skipped
# └── test_decorator_thing: skipped
# └── test_decorator_thing_2: skipped
# ├── TestClass
# │   └── test_class_function_a: skipped
# │   └── test_class_function_b: skipped

skip_tests_path = TEST_DATA_PATH / "skip_tests.py"
skip_tests_execution_expected_output = {
    get_absolute_test_id("skip_tests.py::test_something", skip_tests_path): {
        "test": get_absolute_test_id("skip_tests.py::test_something", skip_tests_path),
        "outcome": "success",
        "message": None,
        "traceback": None,
        "subtest": None,
    },
    get_absolute_test_id("skip_tests.py::test_another_thing", skip_tests_path): {
        "test": get_absolute_test_id(
            "skip_tests.py::test_another_thing", skip_tests_path
        ),
        "outcome": "skipped",
        "message": None,
        "traceback": None,
        "subtest": None,
    },
    get_absolute_test_id("skip_tests.py::test_decorator_thing", skip_tests_path): {
        "test": get_absolute_test_id(
            "skip_tests.py::test_decorator_thing", skip_tests_path
        ),
        "outcome": "skipped",
        "message": None,
        "traceback": None,
        "subtest": None,
    },
    get_absolute_test_id("skip_tests.py::test_decorator_thing_2", skip_tests_path): {
        "test": get_absolute_test_id(
            "skip_tests.py::test_decorator_thing_2", skip_tests_path
        ),
        "outcome": "skipped",
        "message": None,
        "traceback": None,
        "subtest": None,
    },
    get_absolute_test_id(
        "skip_tests.py::TestClass::test_class_function_a", skip_tests_path
    ): {
        "test": get_absolute_test_id(
            "skip_tests.py::TestClass::test_class_function_a", skip_tests_path
        ),
        "outcome": "skipped",
        "message": None,
        "traceback": None,
        "subtest": None,
    },
    get_absolute_test_id(
        "skip_tests.py::TestClass::test_class_function_b", skip_tests_path
    ): {
        "test": get_absolute_test_id(
            "skip_tests.py::TestClass::test_class_function_b", skip_tests_path
        ),
        "outcome": "skipped",
        "message": None,
        "traceback": None,
        "subtest": None,
    },
}


# This is the expected output for the dual_level_nested_folder.py tests
#  └── dual_level_nested_folder
#    └── test_top_folder.py
#       └── test_top_function_t: success
#       └── test_top_function_f: failure
#    └── nested_folder_one
#       └── test_bottom_folder.py
#          └── test_bottom_function_t: success
#          └── test_bottom_function_f: failure
dual_level_nested_folder_top_path = (
    TEST_DATA_PATH / "dual_level_nested_folder" / "test_top_folder.py"
)
dual_level_nested_folder_bottom_path = (
    TEST_DATA_PATH
    / "dual_level_nested_folder"
    / "nested_folder_one"
    / "test_bottom_folder.py"
)
dual_level_nested_folder_execution_expected_output = {
    get_absolute_test_id(
        "test_top_folder.py::test_top_function_t", dual_level_nested_folder_top_path
    ): {
        "test": get_absolute_test_id(
            "test_top_folder.py::test_top_function_t", dual_level_nested_folder_top_path
        ),
        "outcome": "success",
        "message": None,
        "traceback": None,
        "subtest": None,
    },
    get_absolute_test_id(
        "test_top_folder.py::test_top_function_f", dual_level_nested_folder_top_path
    ): {
        "test": get_absolute_test_id(
            "test_top_folder.py::test_top_function_f", dual_level_nested_folder_top_path
        ),
        "outcome": "failure",
        "message": "ERROR MESSAGE",
        "traceback": None,
        "subtest": None,
    },
    get_absolute_test_id(
        "nested_folder_one/test_bottom_folder.py::test_bottom_function_t",
        dual_level_nested_folder_bottom_path,
    ): {
        "test": get_absolute_test_id(
            "nested_folder_one/test_bottom_folder.py::test_bottom_function_t",
            dual_level_nested_folder_bottom_path,
        ),
        "outcome": "success",
        "message": None,
        "traceback": None,
        "subtest": None,
    },
    get_absolute_test_id(
        "nested_folder_one/test_bottom_folder.py::test_bottom_function_f",
        dual_level_nested_folder_bottom_path,
    ): {
        "test": get_absolute_test_id(
            "nested_folder_one/test_bottom_folder.py::test_bottom_function_f",
            dual_level_nested_folder_bottom_path,
        ),
        "outcome": "failure",
        "message": "ERROR MESSAGE",
        "traceback": None,
        "subtest": None,
    },
}

# This is the expected output for the nested_folder tests.
# └── folder_a
#    └── folder_b
#       └── folder_a
#           └── test_nest.py
#               └── test_function: success

nested_folder_path = (
    TEST_DATA_PATH / "folder_a" / "folder_b" / "folder_a" / "test_nest.py"
)
double_nested_folder_expected_execution_output = {
    get_absolute_test_id(
        "folder_a/folder_b/folder_a/test_nest.py::test_function", nested_folder_path
    ): {
        "test": get_absolute_test_id(
            "folder_a/folder_b/folder_a/test_nest.py::test_function", nested_folder_path
        ),
        "outcome": "success",
        "message": None,
        "traceback": None,
        "subtest": None,
    }
}
# This is the expected output for the nested_folder tests.
# └── parametrize_tests.py
#    └── test_adding[3+5-8]: success
#    └── test_adding[2+4-6]: success
#    └── test_adding[6+9-16]: failure
parametrize_tests_path = TEST_DATA_PATH / "parametrize_tests.py"

parametrize_tests_expected_execution_output = {
    get_absolute_test_id(
        "parametrize_tests.py::test_adding[3+5-8]", parametrize_tests_path
    ): {
        "test": get_absolute_test_id(
            "parametrize_tests.py::test_adding[3+5-8]", parametrize_tests_path
        ),
        "outcome": "success",
        "message": None,
        "traceback": None,
        "subtest": None,
    },
    get_absolute_test_id(
        "parametrize_tests.py::test_adding[2+4-6]", parametrize_tests_path
    ): {
        "test": get_absolute_test_id(
            "parametrize_tests.py::test_adding[2+4-6]", parametrize_tests_path
        ),
        "outcome": "success",
        "message": None,
        "traceback": None,
        "subtest": None,
    },
    get_absolute_test_id(
        "parametrize_tests.py::test_adding[6+9-16]", parametrize_tests_path
    ): {
        "test": get_absolute_test_id(
            "parametrize_tests.py::test_adding[6+9-16]", parametrize_tests_path
        ),
        "outcome": "failure",
        "message": "ERROR MESSAGE",
        "traceback": None,
        "subtest": None,
    },
}

# This is the expected output for the single parameterized tests.
# └── parametrize_tests.py
#    └── test_adding[3+5-8]: success
single_parametrize_tests_expected_execution_output = {
    get_absolute_test_id(
        "parametrize_tests.py::test_adding[3+5-8]", parametrize_tests_path
    ): {
        "test": get_absolute_test_id(
            "parametrize_tests.py::test_adding[3+5-8]", parametrize_tests_path
        ),
        "outcome": "success",
        "message": None,
        "traceback": None,
        "subtest": None,
    },
}

# This is the expected output for the single parameterized tests.
# └── text_docstring.txt
#    └── text_docstring: success
doc_test_path = TEST_DATA_PATH / "text_docstring.txt"
doctest_pytest_expected_execution_output = {
    get_absolute_test_id("text_docstring.txt::text_docstring.txt", doc_test_path): {
        "test": get_absolute_test_id(
            "text_docstring.txt::text_docstring.txt", doc_test_path
        ),
        "outcome": "success",
        "message": None,
        "traceback": None,
        "subtest": None,
    }
}

# Will run all tests in the cwd that fit the test file naming pattern.
folder_a_path = TEST_DATA_PATH / "folder_a" / "folder_b" / "folder_a" / "test_nest.py"
dual_level_nested_folder_top_path = (
    TEST_DATA_PATH / "dual_level_nested_folder" / "test_top_folder.py"
)
dual_level_nested_folder_bottom_path = (
    TEST_DATA_PATH
    / "dual_level_nested_folder"
    / "nested_folder_one"
    / "test_bottom_folder.py"
)
unittest_folder_add_path = TEST_DATA_PATH / "unittest_folder" / "test_add.py"
unittest_folder_subtract_path = TEST_DATA_PATH / "unittest_folder" / "test_subtract.py"

no_test_ids_pytest_execution_expected_output = {
    get_absolute_test_id("test_function", folder_a_path): {
        "test": get_absolute_test_id("test_function", folder_a_path),
        "outcome": "success",
        "message": None,
        "traceback": None,
        "subtest": None,
    },
    get_absolute_test_id("test_top_function_t", dual_level_nested_folder_top_path): {
        "test": get_absolute_test_id(
            "test_top_function_t", dual_level_nested_folder_top_path
        ),
        "outcome": "success",
        "message": None,
        "traceback": None,
        "subtest": None,
    },
    get_absolute_test_id("test_top_function_f", dual_level_nested_folder_top_path): {
        "test": get_absolute_test_id(
            "test_top_function_f", dual_level_nested_folder_top_path
        ),
        "outcome": "failure",
        "message": "ERROR MESSAGE",
        "traceback": None,
        "subtest": None,
    },
    get_absolute_test_id(
        "test_bottom_function_t", dual_level_nested_folder_bottom_path
    ): {
        "test": get_absolute_test_id(
            "test_bottom_function_t", dual_level_nested_folder_bottom_path
        ),
        "outcome": "success",
        "message": None,
        "traceback": None,
        "subtest": None,
    },
    get_absolute_test_id(
        "test_bottom_function_f", dual_level_nested_folder_bottom_path
    ): {
        "test": get_absolute_test_id(
            "test_bottom_function_f", dual_level_nested_folder_bottom_path
        ),
        "outcome": "failure",
        "message": "ERROR MESSAGE",
        "traceback": None,
        "subtest": None,
    },
    get_absolute_test_id(
        "TestAddFunction::test_add_negative_numbers", unittest_folder_add_path
    ): {
        "test": get_absolute_test_id(
            "TestAddFunction::test_add_negative_numbers", unittest_folder_add_path
        ),
        "outcome": "success",
        "message": None,
        "traceback": None,
        "subtest": None,
    },
    get_absolute_test_id(
        "TestAddFunction::test_add_positive_numbers", unittest_folder_add_path
    ): {
        "test": get_absolute_test_id(
            "TestAddFunction::test_add_positive_numbers", unittest_folder_add_path
        ),
        "outcome": "success",
        "message": None,
        "traceback": None,
        "subtest": None,
    },
    get_absolute_test_id(
        "TestSubtractFunction::test_subtract_negative_numbers",
        unittest_folder_subtract_path,
    ): {
        "test": get_absolute_test_id(
            "TestSubtractFunction::test_subtract_negative_numbers",
            unittest_folder_subtract_path,
        ),
        "outcome": "failure",
        "message": "ERROR MESSAGE",
        "traceback": None,
        "subtest": None,
    },
    get_absolute_test_id(
        "TestSubtractFunction::test_subtract_positive_numbers",
        unittest_folder_subtract_path,
    ): {
        "test": get_absolute_test_id(
            "TestSubtractFunction::test_subtract_positive_numbers",
            unittest_folder_subtract_path,
        ),
        "outcome": "success",
        "message": None,
        "traceback": None,
        "subtest": None,
    },
}

# This is the expected output for the root folder with the config file referenced.
# └── test_a.py
#    └── test_a_function: success
test_add_path = TEST_DATA_PATH / "root" / "tests" / "test_a.py"
config_file_pytest_expected_execution_output = {
    get_absolute_test_id("tests/test_a.py::test_a_function", test_add_path): {
        "test": get_absolute_test_id("tests/test_a.py::test_a_function", test_add_path),
        "outcome": "success",
        "message": None,
        "traceback": None,
        "subtest": None,
    }
}
