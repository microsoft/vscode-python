# change to fit for everyone
TEST_DATA_PATH = (
    "/Users/eleanorboyd/vscode-python/pythonFiles/tests/pytestadapter/.data"
)
UNITTEST_FOLDER_PATH = "/Users/eleanorboyd/vscode-python/pythonFiles/tests/pytestadapter/.data/unittest_folder_discovery_pytest/"


empty_discovery_pytest_expected_output = {
    "name": ".data",
    "path": TEST_DATA_PATH,
    "type_": "folder",
    "children": [],
    "id_": TEST_DATA_PATH,
}

simple_discovery_pytest_expected_output = {
    "name": ".data",
    "path": TEST_DATA_PATH,
    "type_": "folder",
    "children": [
        {
            "name": "simple_discovery_pytest.py",
            "path": f"{TEST_DATA_PATH}/simple_discovery_pytest.py",
            "type_": "file",
            "id_": f"{TEST_DATA_PATH}/simple_discovery_pytest.py",
            "children": [
                {
                    "name": "test_function",
                    "path": f"{TEST_DATA_PATH}/simple_discovery_pytest.py",
                    "lineno": "5",
                    "type_": "test",
                    "id_": "simple_discovery_pytest.py::test_function",
                    "runID": "simple_discovery_pytest.py::test_function",
                }
            ],
        }
    ],
    "id_": TEST_DATA_PATH,
}

unit_pytest_discovery_pytest_expected_output = {
    "name": ".data",
    "path": TEST_DATA_PATH,
    "type_": "folder",
    "children": [
        {
            "name": "unit_pytest_discovery_pytest.py",
            "path": TEST_DATA_PATH + "/unit_pytest_discovery_pytest.py",
            "type_": "file",
            "id_": TEST_DATA_PATH + "/unit_pytest_discovery_pytest.py",
            "children": [
                {
                    "name": "TestExample",
                    "path": TEST_DATA_PATH + "/unit_pytest_discovery_pytest.py",
                    "type_": "class",
                    "children": [
                        {
                            "name": "test_true_unittest",
                            "path": TEST_DATA_PATH + "/unit_pytest_discovery_pytest.py",
                            "lineno": "8",
                            "type_": "test",
                            "id_": "unit_pytest_discovery_pytest.py::TestExample::test_true_unittest",
                            "runID": "unit_pytest_discovery_pytest.py::TestExample::test_true_unittest",
                        }
                    ],
                    "id_": "unit_pytest_discovery_pytest.py::TestExample",
                },
                {
                    "name": "test_true_pytest",
                    "path": TEST_DATA_PATH + "/unit_pytest_discovery_pytest.py",
                    "lineno": "12",
                    "type_": "test",
                    "id_": "unit_pytest_discovery_pytest.py::test_true_pytest",
                    "runID": "unit_pytest_discovery_pytest.py::test_true_pytest",
                },
            ],
        }
    ],
    "id_": TEST_DATA_PATH,
}

unit_pytest_discovery_pytest_expected_output = tests = {
    "name": ".data",
    "path": "/Users/eleanorboyd/vscode-python/pythonFiles/tests/pytestadapter/.data",
    "type_": "folder",
    "children": [
        {
            "name": "unittest_folder_discovery_pytest",
            "path": UNITTEST_FOLDER_PATH,
            "type_": "folder",
            "id_": UNITTEST_FOLDER_PATH,
            "children": [
                {
                    "name": "test_add.py",
                    "path": UNITTEST_FOLDER_PATH + "test_add.py",
                    "type_": "file",
                    "id_": UNITTEST_FOLDER_PATH + "test_add.py",
                    "children": [
                        {
                            "name": "TestAddFunction",
                            "path": UNITTEST_FOLDER_PATH + "test_add.py",
                            "type_": "class",
                            "children": [
                                {
                                    "name": "test_add_negative_numbers",
                                    "path": UNITTEST_FOLDER_PATH + "test_add.py",
                                    "lineno": "13",
                                    "type_": "test",
                                    "id_": "unittest_folder_discovery_pytest/test_add.py::TestAddFunction::test_add_negative_numbers",
                                    "runID": "unittest_folder_discovery_pytest/test_add.py::TestAddFunction::test_add_negative_numbers",
                                },
                                {
                                    "name": "test_add_positive_numbers",
                                    "path": UNITTEST_FOLDER_PATH + "test_add.py",
                                    "lineno": "9",
                                    "type_": "test",
                                    "id_": "unittest_folder_discovery_pytest/test_add.py::TestAddFunction::test_add_positive_numbers",
                                    "runID": "unittest_folder_discovery_pytest/test_add.py::TestAddFunction::test_add_positive_numbers",
                                },
                            ],
                            "id_": "unittest_folder_discovery_pytest/test_add.py::TestAddFunction",
                        },
                    ],
                },
                {
                    "name": "test_subtract.py",
                    "path": UNITTEST_FOLDER_PATH + "test_subtract.py",
                    "type_": "file",
                    "id_": UNITTEST_FOLDER_PATH + "test_subtract.py",
                    "children": [
                        {
                            "name": "TestSubtractFunction",
                            "path": UNITTEST_FOLDER_PATH + "test_subtract.py",
                            "type_": "class",
                            "children": [
                                {
                                    "name": "test_subtract_negative_numbers",
                                    "path": UNITTEST_FOLDER_PATH + "test_subtract.py",
                                    "lineno": "13",
                                    "type_": "test",
                                    "id_": "unittest_folder_discovery_pytest/test_subtract.py::TestSubtractFunction::test_subtract_negative_numbers",
                                    "runID": "unittest_folder_discovery_pytest/test_subtract.py::TestSubtractFunction::test_subtract_negative_numbers",
                                },
                                {
                                    "name": "test_subtract_positive_numbers",
                                    "path": UNITTEST_FOLDER_PATH + "test_subtract.py",
                                    "lineno": "9",
                                    "type_": "test",
                                    "id_": "unittest_folder_discovery_pytest/test_subtract.py::TestSubtractFunction::test_subtract_positive_numbers",
                                    "runID": "unittest_folder_discovery_pytest/test_subtract.py::TestSubtractFunction::test_subtract_positive_numbers",
                                },
                            ],
                            "id_": "unittest_folder_discovery_pytest/test_subtract.py::TestSubtractFunction",
                        },
                    ],
                },
            ],
        },
    ],
    "id_": "/Users/eleanorboyd/vscode-python/pythonFiles/tests/pytestadapter/.data",
}
