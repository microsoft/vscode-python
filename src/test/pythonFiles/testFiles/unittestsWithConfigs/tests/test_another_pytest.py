# content of tests/test_something.py
import pytest
import unittest

@pytest.fixture
def parametrized_username():
    return 'overridden-username'
 
@pytest.fixture(params=['one', 'two', 'three'])
def non_parametrized_username(request):
    return request.param
 
def test_username(parametrized_username):
    assert parametrized_username == 'overridden-username'
 
def test_parametrized_username(non_parametrized_username):
    assert non_parametrized_username in ['one', 'two', 'threes']
    
