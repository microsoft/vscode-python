import get_variable_info


def set_global_variable(value):
    # setting on the module allows tests to set a variable that the module under test can access
    get_variable_info.test_variable = value


def get_global_variable():
    results = get_variable_info.getVariableDescriptions()
    for variable in results:
        if variable["name"] == "test_variable":
            return variable
    return None


def assert_variable_found(variable, expected_value, expected_type, expected_count):
    set_global_variable(variable)
    variable = get_global_variable()
    assert variable["value"] == expected_value
    assert variable["type"] == expected_type
    if expected_count is not None:
        assert variable["count"] == expected_count
    return variable


def test_simple():
    assert_variable_found(1, "1", "int", None)


def test_list():
    assert_variable_found([1, 2, 3], "[1, 2, 3]", "list", None)


def test_dict():
    assert_variable_found({"a": 1, "b": 2}, "{'a': 1, 'b': 2}", "dict", None)


def test_tuple():
    assert_variable_found((1, 2, 3), "(1, 2, 3)", "tuple", None)


def test_set():
    assert_variable_found({1, 2, 3}, "{1, 2, 3}", "set", None)


def test_self_referencing_dict():
    d = {}
    d["self"] = d
    assert_variable_found(d, "{'self': {...}}", "dict", None)
