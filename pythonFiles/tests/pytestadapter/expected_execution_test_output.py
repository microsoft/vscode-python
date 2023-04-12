# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

TEST_SUBTRACT_FUNCTION = "unittest_folder/test_subtract.py::TestSubtractFunction::"
TEST_ADD_FUNCTION = "unittest_folder/test_add.py::TestAddFunction::"
CWD = "/Users/eleanorboyd/Documents/testingFiles/playground_run_tests"
SUCCESS = "success"
FAILURE = "failure"
NONE = "None"
ASSERTION_ERROR = "<class 'AssertionError'>, AssertionError('1 != 10000'), <traceback object at 0x100eb2880>"

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
        "message": "self = <test_subtract.TestSubtractFunction testMethod=test_subtract_negative_numbers>\n\n    def test_subtract_negative_numbers(  # test_marker--test_subtract_negative_numbers\n        self,\n    ):\n        result = subtract(-2, -3)\n>       self.assertEqual(result, 100000)\nE       AssertionError: 1 != 100000\n\nunittest_folder/test_subtract.py:25: AssertionError",
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


# This is the expected output for the unittest_folder add only execute tests
# └── unittest_folder
#    ├── test_add.py
#    │   └── TestAddFunction
#    │       ├── test_add_negative_numbers: success
#    │       └── test_add_positive_numbers: success
uf_single_file_expected_output = {
    f"{TEST_ADD_FUNCTION}.test_add_negative_numbers": {
        "test": f"{TEST_ADD_FUNCTION}.test_add_negative_numbers",
        "outcome": SUCCESS,
        "message": None,
        "traceback": None,
        "subtest": None,
    },
    f"{TEST_ADD_FUNCTION}.test_add_positive_numbers": {
        "test": f"{TEST_ADD_FUNCTION}.test_add_positive_numbers",
        "outcome": SUCCESS,
        "message": NONE,
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
    "cwd": CWD,
    "status": SUCCESS,
    "result": {
        f"{TEST_ADD_FUNCTION}.test_add_positive_numbers": {
            "test": f"{TEST_ADD_FUNCTION}.test_add_positive_numbers",
            "outcome": SUCCESS,
            "message": NONE,
            "traceback": None,
            "subtest": None,
        }
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
uf_non_adjacent_tests_execution_expected_output = {
    "cwd": CWD,
    "status": SUCCESS,
    "result": {
        TEST_SUBTRACT_FUNCTION
        + ".test_subtract_positive_numbers": {
            "test": TEST_SUBTRACT_FUNCTION + ".test_subtract_positive_numbers",
            "outcome": SUCCESS,
            "message": NONE,
            "traceback": None,
            "subtest": None,
        },
        TEST_ADD_FUNCTION
        + ".test_add_positive_numbers": {
            "test": TEST_ADD_FUNCTION + ".test_add_positive_numbers",
            "outcome": SUCCESS,
            "message": NONE,
            "traceback": None,
            "subtest": None,
        },
    },
}
