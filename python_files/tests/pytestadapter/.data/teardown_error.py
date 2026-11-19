# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import pytest


@pytest.fixture
def raise_in_teardown():
    yield
    raise Exception("Dummy teardown exception")


@pytest.fixture
def assert_in_teardown():
    yield
    assert False


@pytest.fixture
def raise_in_finalizer(request):
    def finalizer():
        raise Exception("Dummy finalizer exception")

    request.addfinalizer(finalizer)


@pytest.fixture(scope="class")
def raise_in_class_teardown():
    yield
    raise Exception("Dummy class teardown exception")


def test_teardown_raises(raise_in_teardown):
    assert True


def test_teardown_asserts(assert_in_teardown):
    assert True


def test_finalizer_raises(raise_in_finalizer):
    assert True


def test_call_and_teardown_fail(raise_in_teardown):
    assert False


def test_no_teardown_error():
    assert True


class TestClassTeardown:
    def test_class_teardown_raises(self, raise_in_class_teardown):
        assert True
