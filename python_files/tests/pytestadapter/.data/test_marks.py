# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import pytest


@pytest.mark.slow  # test_marker--test_with_single_mark
def test_with_single_mark():
    assert True


@pytest.mark.slow  # test_marker--test_with_multiple_marks
@pytest.mark.integration
def test_with_multiple_marks():
    assert True


def test_with_no_marks():  # test_marker--test_with_no_marks
    assert True


@pytest.mark.slow  # test_marker--test_with_duplicate_marks
@pytest.mark.slow
def test_with_duplicate_marks():
    assert True


@pytest.mark.parametrize("x", [1, 2])  # test_marker--test_parametrize_with_mark
@pytest.mark.slow
def test_parametrize_with_mark(x):
    assert x > 0
