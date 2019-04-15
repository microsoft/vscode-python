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


# legend for parameterized test names:
#  "test_param_XY[_XY]*"
#  X      - # params
#  Y      - # cases
#  [_XY]* - extra decorators

@pytest.mark.parametrize('', [()])
def test_param_01():
    assert True


@pytest.mark.parametrize('x', [(1,)])
def test_param_11(x):
    assert x == 1


@pytest.mark.parametrize('x', [(1,), (1.0,), (1+0j,)])
def test_param_13(x):
    assert x == 1


@pytest.mark.parametrize('x', [(1,), (1,), (1,)])
def test_param_13_repeat(x):
    assert x == 1


@pytest.mark.parametrize('x,y,z', [(1, 1, 1), (3, 4, 5), (0, 0, 0)])
def test_param_33(x, y, z):
    assert x*x + y*y == z*z


@pytest.mark.parametrize('x,y,z', [(1, 1, 1), (3, 4, 5), (0, 0, 0)],
                         ids=['v1', 'v2', 'v3'])
def test_param_33_ids(x, y, z):
    assert x*x + y*y == z*z


@pytest.mark.parametrize('z', [(1,), (5,), (0,)])
@pytest.mark.parametrize('x,y', [(1, 1), (3, 4), (0, 0)])
def test_param_23_13(x, y, z):
    assert x*x + y*y == z*z


@pytest.mark.parametrize('x', [
    (1,),
    pytest.param(1.0, marks=[pytest.mark.skip, pytest.mark.spam], id='???'),
    pytest.param(2, marks=[pytest.mark.xfail]),
    ])
def test_param_13_markers(x):
    assert x == 1


@pytest.mark.skip
@pytest.mark.parametrize('x', [(1,), (1.0,), (1+0j,)])
def test_param_13_skipped(x):
    assert x == 1


@pytest.mark.parametrize('x,catch', [(1, None), (1.0, None), (2, pytest.raises(Exception))])
def test_param_23_raises(x, catch):
    if x != 1:
        with catch:
            raise Exception


class TestParam(object):

    def test_simple():
        assert True

    @pytest.mark.parametrize('x', [(1,), (1.0,), (1+0j,)])
    def test_param_13(self, x):
        assert x == 1


@pytest.mark.parametrize('x', [(1,), (1.0,), (1+0j,)])
class TestParamAll(object):

    def test_param_13(self, x):
        assert x == 1

    def test_spam_13(self, x):
        assert x == 1


@pytest.fixture
def spamfix(request):
    yield 'spam'


@pytest.fixture(params=['spam', 'eggs'])
def paramfix(request):
    return request.param


def test_fixture(spamfix):
    assert spamfix == 'spam'


@pytest.mark.usefixtures('spamfix')
def test_mark_fixture():
    assert True


@pytest.mark.parametrize('x', [(1,), (1.0,), (1+0j,)])
def test_param_fixture(spamfix, x):
    assert spamfix == 'spam'
    assert x == 1


@pytest.mark.parametrize('x', [
    (1,),
    (1.0,),
    pytest.param(1+0j, marks=[pytest.mark.usefixtures('spamfix')]),
    ])
def test_param_mark_fixture(x):
    assert x == 1


def test_fixture_param(paramfix):
    assert paramfix == 'spam'


class TestNoop3(object):
    pass


class MyTests(object):  # does not match default name pattern

    def test_simple():
        assert True
