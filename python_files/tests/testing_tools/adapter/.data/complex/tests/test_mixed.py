import pytest
import unittest


def test_top_level():
    assert True


@pytest.mark.skip
def test_skipped():
    assert False


class TestMySuite(object):

    def test_simple(self):
        assert True


class MyTests(unittest.TestCase):

    def test_simple(self):
        assert True

    @pytest.mark.skip
    def test_skipped(self):
        assert False
