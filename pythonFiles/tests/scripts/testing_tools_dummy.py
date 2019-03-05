import json

"""Simple scenario of a single test file at the workspace root with a test suite."""
single_test_file_at_root = [
    {
        "id": "test_single_at_root.py::TestSingleTestAtRoot::test_fail",
        "name": "test_fail",
        "testroot": "C:\\dev\\github\\d3r3kk\\test\\test_scenario\\single_test_file_at_root",
        "relfile": ".\\test_single_at_root.py",
        "lineno": 7, "testfunc": "TestSingleTestAtRoot.test_fail",
        "subtest": None,
        "markers": None
    },
    {
        "id": "test_single_at_root.py::TestSingleTestAtRoot::test_success",
        "name": "test_success",
        "testroot": "C:\\dev\\github\\d3r3kk\\test\\test_scenario\\single_test_file_at_root",
        "relfile": ".\\test_single_at_root.py",
        "lineno": 4,
        "testfunc": "TestSingleTestAtRoot.test_success",
        "subtest": None,
        "markers": None
    }
]

"""Simple scenario: single test file at the workspace root containing 2 test suites."""
single_test_file_at_root_two_suites = [
    {
        "id": "test_single_at_root.py::TestSingleTestAtRoot::test_fail",
        "name": "test_fail",
        "testroot": "C:\\dev\\github\\d3r3kk\\test\\test_scenario\\single_test_file_at_root",
        "relfile": ".\\test_single_at_root.py",
        "lineno": 7,
        "testfunc": "TestSingleTestAtRoot.test_fail",
        "subtest": None,
        "markers": None
    },
    {
        "id": "test_single_at_root.py::TestSingleTestAtRoot::test_success",
        "name": "test_success",
        "testroot": "C:\\dev\\github\\d3r3kk\\test\\test_scenario\\single_test_file_at_root",
        "relfile": ".\\test_single_at_root.py",
        "lineno": 4,
        "testfunc": "TestSingleTestAtRoot.test_success",
        "subtest": None,
        "markers": None
    },
    {
        "id": "test_single_at_root.py::TestSingleAtRootSuite::test_suite_fail",
        "name": "test_suite_fail",
        "testroot": "C:\\dev\\github\\d3r3kk\\test\\test_scenario\\single_test_file_at_root",
        "relfile": ".\\test_single_at_root.py",
        "lineno": 14,
        "testfunc": "TestSingleAtRootSuite.test_suite_fail",
        "subtest": None,
        "markers": None
    },
    {
        "id": "test_single_at_root.py::TestSingleAtRootSuite::test_suite_success",
        "name": "test_suite_success",
        "testroot": "C:\\dev\\github\\d3r3kk\\test\\test_scenario\\single_test_file_at_root",
        "relfile": ".\\test_single_at_root.py",
        "lineno": 11,
        "testfunc": "TestSingleAtRootSuite.test_suite_success",
        "subtest": None,
        "markers": None
    }
]

single_test_file_subroot_one_suite = [
    {
        "id": "test/test_single_sub_root.py::TestSingleTestSubRoot::test_fail",
        "name": "test_fail",
        "testroot": "C:\\dev\\github\\d3r3kk\\test\\test_scenario\\single_test_file_sub_root",
        "relfile": "test\\test_single_sub_root.py",
        "lineno": 7,
        "testfunc": "TestSingleTestSubRoot.test_fail",
        "subtest": None,
        "markers": None
    },
    {
        "id": "test/test_single_sub_root.py::TestSingleTestSubRoot::test_success",
        "name": "test_success",
        "testroot": "C:\\dev\\github\\d3r3kk\\test\\test_scenario\\single_test_file_sub_root",
        "relfile": "test\\test_single_sub_root.py",
        "lineno": 4,
        "testfunc": "TestSingleTestSubRoot.test_success",
        "subtest": None,
        "markers": None
    }
]

if __name__ == "__main__":
    print(json.dumps(single_test_file_at_root))
