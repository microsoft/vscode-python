
## Directory Structure

```
pythonFiles/tests/testing_tools/adapter/.data/
   tests/  # test root
       test_doctest.txt
       test_pytest.py
       test_unittest.py
       test_mixed.py
       spam.py  # note: no "test_" prefix, but contains tests
       test_foo.py
       test_42.py
       test_42-43.py  # note the hyphen
       testspam.py
       v/
           __init__.py
           spam.py
           test_eggs.py
           test_ham.py
           test_spam.py
       w/
           # no __init__.py
           test_spam.py
           test_spam_ex.py
       x/y/z/   # each with a __init__.py
           test_ham.py
           a/
               __init__.py
               test_spam.py
           b/
               __init__.py
               test_spam.py
```

## Tests (and Suites)

basic:

* `./test_foo.py::test_simple`
* `./test_pytest.py::test_simple`
* `./x/y/z/test_ham.py::test_simple`
* `./x/y/z/a/test_spam.py::test_simple`
* `./x/y/z/b/test_spam.py::test_simple`

in namespace package:

* `./w/test_spam.py::test_simple`
* `./w/test_spam_ex.py::test_simple`

filename oddities:

* `./test_42.py::test_simple`
* `./test_42-43.py::test_simple`
* (`./testspam.py::test_simple` not discovered by default)
* (`./spam.py::test_simple` not discovered)

imports discovered:

* `./v/test_eggs.py::test_simple`
* `./v/test_eggs.py::TestSimple::test_simple`
* `./v/test_ham.py::test_simple`
* `./v/test_ham.py::test_not_hard`
* `./v/test_spam.py::test_simple`
* `./v/test_spam.py::test_simpler`


missing:

```
doctests:

* `./test_doctest.txt` - ???




* `test_pytest.py` - 
    * module-level doctests
    * marked test functions
        + skip, skipif, xfail, filterwarnings, custom  # see https://docs.pytest.org/en/latest/reference.html#marks
        + one function for each
        + at least one function with multiple marks
    * parameterized test functions
        + no parameters, single case
        + one parameter, single case
        + one parameter, multiple cases
        + multiple parameters, multiple cases
        + with *args & **kwargs parameters, multiple cases
        + 4 parameters, 3 decorators
        + decorator with "marks" arg (skip/xfail/etc)
    * test function that calls pytest.skip()
    * test function that calls pytest.fail()
    * test function that raises Exception
    * for loop that generates test functions dynamically
    * suite (a test class)
        + simple test method
        + suite-level doctests
        + marked ("skip") test method
        + parameterized test method
        + nested suite
            + nested suite
                 + simple test method
                 + nested suite (no methods)
        + nested suite (no methods)
    * another suite
        + a simple test method
    * an empty suite
    * suite using a fixture


test_unittest.py
    * test suite inheriting from unittest.TestCase
        + simple test function
        + skipped test method (decorator)
        + skip-if'ed test method (decorator)
        + test method with expected failure decorator
        + test method that raises unittest.Skip
        + test method that calls unittest.skip()
        + test method that raises Exception
        + test method that uses one "with self.subtest():"
        + test method that uses multiple "with self.subtest():" (nested)
        + for loop that generates test methods dynamically
        + nested class (no base class)
        + nested class inheriting from unittest.TestCase
    * another suite
        + a simple test method
    * an empty suite


test_mixed.py
     * module-level test function (a la pytest)
     * marked ("skip") test function
     * class with no base class (a la pytest)
         + a simple test method
     * class inheriting from unittest.TestCase
         + simple test method
```
