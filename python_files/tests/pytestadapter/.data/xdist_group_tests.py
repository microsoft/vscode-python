# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import pytest

# With --dist=loadgroup, pytest-xdist adds "@group_a" to the ids of the grouped tests.


@pytest.mark.xdist_group("group_a")
def test_grouped():  # test_marker--test_grouped
    assert True


# The first parameter id contains "@" to check that only the group suffix is removed.
@pytest.mark.xdist_group("group_a")
@pytest.mark.parametrize("email", ["user@example.com", "no-at-sign"])
def test_grouped_param(email):  # test_marker--test_grouped_param
    assert "@" in email


@pytest.mark.xdist_group("group_a")
@pytest.mark.skip(reason="Skipped to check that skipped results use the original test id")
def test_grouped_skipped():  # test_marker--test_grouped_skipped
    assert True


def test_ungrouped():  # test_marker--test_ungrouped
    assert True
