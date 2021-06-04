import pytest
import unittest


def test_numbers():
    pass


@pytest.mark.parametrize(("x"), [[0], [1], [10]])
def test_numbers2(x):
    pass


@pytest.mark.skip()
def test_numbers_skip(x):
    pass


class StringTest(unittest.TestCase):
    def test_str():
        pass

    @unittest.skip("skipping")
    def test_str_skip(x):
        pass
