# content of tests/test_something.py
import pytest
import unittest

# content of check_myapp.py
class Test_CheckMyApp:
    @unittest.skip("demonstrating skipping")
    def test_simple_check(self):
        pass
    def test_complex_check(self):
        pass    
 
    class Test_NestedClassA:
        def test_nested_class_methodB(self):
            assert True
        class Test_nested_classB_Of_A:
            def test_d(self):
                assert True
        def test_nested_class_methodC(self):
            assert True

    def test_simple_check2(self):
        pass
    def test_complex_check2(self):
        pass    

                        
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
    
