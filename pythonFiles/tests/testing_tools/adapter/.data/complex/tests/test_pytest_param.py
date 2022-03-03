import pytest


# module-level parameterization
pytestmark = pytest.mark.parametrize('x', [(1,), (1.0,), (1+0j,)])


def test_param_13(x):
    assert x == 1


class TestParamAll(object):

    def test_param_13(self, x):
        assert x == 1

    def test_spam_13(self, x):
        assert x == 1
