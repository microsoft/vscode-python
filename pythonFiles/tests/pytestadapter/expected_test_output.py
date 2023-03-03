# change to fit for everyone
TEST_DATA_PATH = (
    "/Users/eleanorboyd/vscode-python/pythonFiles/tests/pytestadapter/.data"
)

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
