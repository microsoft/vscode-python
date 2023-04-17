# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

TEST_SUBTRACT_FUNCTION = "unittest_folder/test_subtract.py::TestSubtractFunction::"
TEST_ADD_FUNCTION = "unittest_folder/test_add.py::TestAddFunction::"
SUCCESS = "success"
FAILURE = "failure"
TEST_SUBTRACT_FUNCTION_NEGATIVE_NUMBERS_ERROR = "self = <test_subtract.TestSubtractFunction testMethod=test_subtract_negative_numbers>\n\n    def test_subtract_negative_numbers(  # test_marker--test_subtract_negative_numbers\n        self,\n    ):\n        result = subtract(-2, -3)\n>       self.assertEqual(result, 100000)\nE       AssertionError: 1 != 100000\n\nunittest_folder/test_subtract.py:25: AssertionError"

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
uf_execution_expected_output = {
    f"{TEST_ADD_FUNCTION}test_add_negative_numbers": {
        "test": f"{TEST_ADD_FUNCTION}test_add_negative_numbers",
        "outcome": SUCCESS,
        "message": None,
        "traceback": None,
        "subtest": None,
    },
    f"{TEST_ADD_FUNCTION}test_add_positive_numbers": {
        "test": f"{TEST_ADD_FUNCTION}test_add_positive_numbers",
        "outcome": SUCCESS,
        "message": None,
        "traceback": None,
        "subtest": None,
    },
    f"{TEST_SUBTRACT_FUNCTION}test_subtract_negative_numbers": {
        "test": f"{TEST_SUBTRACT_FUNCTION}test_subtract_negative_numbers",
        "outcome": FAILURE,
        "message": "ERROR MESSAGE",
        "traceback": None,
        "subtest": None,
    },
    f"{TEST_SUBTRACT_FUNCTION}test_subtract_positive_numbers": {
        "test": f"{TEST_SUBTRACT_FUNCTION}test_subtract_positive_numbers",
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
uf_single_file_expected_output = {
    f"{TEST_ADD_FUNCTION}test_add_negative_numbers": {
        "test": f"{TEST_ADD_FUNCTION}test_add_negative_numbers",
        "outcome": SUCCESS,
        "message": None,
        "traceback": None,
        "subtest": None,
    },
    f"{TEST_ADD_FUNCTION}test_add_positive_numbers": {
        "test": f"{TEST_ADD_FUNCTION}test_add_positive_numbers",
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
    f"{TEST_ADD_FUNCTION}test_add_positive_numbers": {
        "test": f"{TEST_ADD_FUNCTION}test_add_positive_numbers",
        "outcome": SUCCESS,
        "message": None,
        "traceback": None,
        "subtest": None,
    }
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
uf_non_adjacent_tests_execution_expected_output = {
    TEST_SUBTRACT_FUNCTION
    + "test_subtract_positive_numbers": {
        "test": TEST_SUBTRACT_FUNCTION + "test_subtract_positive_numbers",
        "outcome": SUCCESS,
        "message": None,
        "traceback": None,
        "subtest": None,
    },
    TEST_ADD_FUNCTION
    + "test_add_positive_numbers": {
        "test": TEST_ADD_FUNCTION + "test_add_positive_numbers",
        "outcome": SUCCESS,
        "message": None,
        "traceback": None,
        "subtest": None,
    },
}

# This is the expected output for the simple_pytest.py file.
# └── simple_pytest.py
#    └── test_function: success
simple_execution_pytest_expected_output = {
    "simple_pytest.py::test_function": {
        "test": "simple_pytest.py::test_function",
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
unit_pytest_same_file_execution_expected_output = {
    "unittest_pytest_same_file.py::TestExample::test_true_unittest": {
        "test": "unittest_pytest_same_file.py::TestExample::test_true_unittest",
        "outcome": "success",
        "message": None,
        "traceback": None,
        "subtest": None,
    },
    "unittest_pytest_same_file.py::test_true_pytest": {
        "test": "unittest_pytest_same_file.py::test_true_pytest",
        "outcome": "success",
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
dual_level_nested_folder_execution_expected_output = {
    "dual_level_nested_folder/test_top_folder.py::test_top_function_t": {
        "test": "dual_level_nested_folder/test_top_folder.py::test_top_function_t",
        "outcome": "success",
        "message": None,
        "traceback": None,
        "subtest": None,
    },
    "dual_level_nested_folder/test_top_folder.py::test_top_function_f": {
        "test": "dual_level_nested_folder/test_top_folder.py::test_top_function_f",
        "outcome": "failure",
        "message": "ERROR MESSAGE",
        "traceback": None,
        "subtest": None,
    },
    "dual_level_nested_folder/nested_folder_one/test_bottom_folder.py::test_bottom_function_t": {
        "test": "dual_level_nested_folder/nested_folder_one/test_bottom_folder.py::test_bottom_function_t",
        "outcome": "success",
        "message": None,
        "traceback": None,
        "subtest": None,
    },
    "dual_level_nested_folder/nested_folder_one/test_bottom_folder.py::test_bottom_function_f": {
        "test": "dual_level_nested_folder/nested_folder_one/test_bottom_folder.py::test_bottom_function_f",
        "outcome": "failure",
        "message": "ERROR MESSAGE",
        "traceback": None,
        "subtest": None,
    },
}

# This is the expected output for the nested_folder tests.
# └── nested_folder_one
#    └── nested_folder_two
#       └── test_nest.py
#          └── test_function: success
double_nested_folder_expected_execution_output = {
    "double_nested_folder/nested_folder_one/nested_folder_two/test_nest.py::test_function": {
        "test": "double_nested_folder/nested_folder_one/nested_folder_two/test_nest.py::test_function",
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
parametrize_tests_expected_execution_output = {
    "parametrize_tests.py::test_adding[3+5-8]": {
        "test": "parametrize_tests.py::test_adding[3+5-8]",
        "outcome": "success",
        "message": None,
        "traceback": None,
        "subtest": None,
    },
    "parametrize_tests.py::test_adding[2+4-6]": {
        "test": "parametrize_tests.py::test_adding[2+4-6]",
        "outcome": "success",
        "message": None,
        "traceback": None,
        "subtest": None,
    },
    "parametrize_tests.py::test_adding[6+9-16]": {
        "test": "parametrize_tests.py::test_adding[6+9-16]",
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
    "parametrize_tests.py::test_adding[3+5-8]": {
        "test": "parametrize_tests.py::test_adding[3+5-8]",
        "outcome": "success",
        "message": None,
        "traceback": None,
        "subtest": None,
    },
}

# This is the expected output for the single parameterized tests.
# └── text_docstring.txt
#    └── text_docstring: success
doctest_pytest_expected_execution_output = {
    "text_docstring.txt::text_docstring.txt": {
        "test": "text_docstring.txt::text_docstring.txt",
        "outcome": "success",
        "message": None,
        "traceback": None,
        "subtest": None,
    }
}

# Will run all tests in the cwd that fit the test file naming pattern.
no_test_ids_pytest_execution_expected_output = {
    "double_nested_folder/nested_folder_one/nested_folder_two/test_nest.py::test_function": {
        "test": "double_nested_folder/nested_folder_one/nested_folder_two/test_nest.py::test_function",
        "outcome": "success",
        "message": None,
        "traceback": None,
        "subtest": None,
    },
    "dual_level_nested_folder/test_top_folder.py::test_top_function_t": {
        "test": "dual_level_nested_folder/test_top_folder.py::test_top_function_t",
        "outcome": "success",
        "message": None,
        "traceback": None,
        "subtest": None,
    },
    "dual_level_nested_folder/test_top_folder.py::test_top_function_f": {
        "test": "dual_level_nested_folder/test_top_folder.py::test_top_function_f",
        "outcome": "failure",
        "message": "ERROR MESSAGE",
        "traceback": None,
        "subtest": None,
    },
    "dual_level_nested_folder/nested_folder_one/test_bottom_folder.py::test_bottom_function_t": {
        "test": "dual_level_nested_folder/nested_folder_one/test_bottom_folder.py::test_bottom_function_t",
        "outcome": "success",
        "message": None,
        "traceback": None,
        "subtest": None,
    },
    "dual_level_nested_folder/nested_folder_one/test_bottom_folder.py::test_bottom_function_f": {
        "test": "dual_level_nested_folder/nested_folder_one/test_bottom_folder.py::test_bottom_function_f",
        "outcome": "failure",
        "message": "ERROR MESSAGE",
        "traceback": None,
        "subtest": None,
    },
    "unittest_folder/test_add.py::TestAddFunction::test_add_negative_numbers": {
        "test": "unittest_folder/test_add.py::TestAddFunction::test_add_negative_numbers",
        "outcome": "success",
        "message": None,
        "traceback": None,
        "subtest": None,
    },
    "unittest_folder/test_add.py::TestAddFunction::test_add_positive_numbers": {
        "test": "unittest_folder/test_add.py::TestAddFunction::test_add_positive_numbers",
        "outcome": "success",
        "message": None,
        "traceback": None,
        "subtest": None,
    },
    "unittest_folder/test_subtract.py::TestSubtractFunction::test_subtract_negative_numbers": {
        "test": "unittest_folder/test_subtract.py::TestSubtractFunction::test_subtract_negative_numbers",
        "outcome": "failure",
        "message": "ERROR MESSAGE",
        "traceback": None,
        "subtest": None,
    },
    "unittest_folder/test_subtract.py::TestSubtractFunction::test_subtract_positive_numbers": {
        "test": "unittest_folder/test_subtract.py::TestSubtractFunction::test_subtract_positive_numbers",
        "outcome": "success",
        "message": None,
        "traceback": None,
        "subtest": None,
    },
}
