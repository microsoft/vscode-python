# ...

import pytest


def test_simple():
    assert True


def test_failure():
    assert False


def test_runtime_skipped():
    pytest.skip('???')


def test_runtime_failed():
    pytest.fail('???')


def test_raises():
    raise Exception


@pytest.mark.skip
def test_skipped():
    assert False


@pytest.mark.skipif(True)
def test_maybe_skipped():
    assert False


@pytest.mark.xfail
def test_known_failure():
    assert False


@pytest.mark.filterwarnings
def test_warned():
    assert False


@pytest.mark.spam
def test_custom_marker():
    assert False


@pytest.mark.filterwarnings
@pytest.mark.skip
@pytest.mark.xfail
@pytest.mark.skipif(True)
@pytest.mark.skip
@pytest.mark.spam
def test_multiple_markers():
    assert False


for i in range(3):
    def func():
        assert True
    globals()['test_dynamic_{}'.format(i + 1)] = func
del func


class TestSpam(object):

    def test_simple():
        assert True

    @pytest.mark.skip
    def test_skipped(self):
        assert False

    class TestHam(object):

        class TestEggs(object):

            def test_simple():
                assert True

            class TestNoop1(object):
                pass

    class TestNoop2(object):
        pass


class TestEggs(object):

    def test_simple():
        assert True


class TestNoop3(object):
    pass


class MyTests(object):  # does not match default name pattern

    def test_simple():
        assert True
