import __builtin__
import exceptions

DIFF_OMITTED = '\nDiff is %s characters long. Set self.maxDiff to None to see it.'
class FunctionTestCase(TestCase):
    "A test case that wraps a test function.\n\n    This is useful for slipping pre-existing test functions into the\n    unittest framework. Optionally, set-up and tidy-up functions can be\n    supplied. As with TestCase, the tidy-up ('tearDown') function will\n    always be called if the set-up ('setUp') function ran successfully.\n    "
    def __call__(self, *args):
        pass
    
    __class__ = FunctionTestCase
    __dict__ = __builtin__.dict()
    def __eq__(self, other):
        return False
    
    def __hash__(self):
        return 0
    
    def __init__(self, testFunc, setUp, tearDown, description):
        pass
    
    def __ne__(self, other):
        return False
    
    def __repr__(self):
        return ''
    
    def __str__(self):
        return ''
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def _addSkip(self, result, reason):
        pass
    
    def _baseAssertEqual(self, first, second, msg):
        'The default assertEqual implementation, not type specific.'
        pass
    
    def _deprecate(self, original_func):
        pass
    
    def _formatMessage(self, msg, standardMsg):
        "Honour the longMessage attribute when generating failure messages.\n        If longMessage is False this means:\n        * Use only an explicit message if it is provided\n        * Otherwise use the standard message for the assert\n\n        If longMessage is True:\n        * Use the standard message\n        * If an explicit message is provided, plus ' : ' and the explicit message\n        "
        pass
    
    def _getAssertEqualityFunc(self, first, second):
        'Get a detailed comparison function for the types of the two args.\n\n        Returns: A callable accepting (first, second, msg=None) that will\n        raise a failure exception if first != second with a useful human\n        readable error message for those types.\n        '
        pass
    
    def _truncateMessage(self, message, diff):
        pass
    
    def addCleanup(self, function, *args):
        'Add a function, with arguments, to be called when the test is\n        completed. Functions added are called on a LIFO basis and are\n        called after tearDown on test failure or success.\n\n        Cleanup items are called even if setUp fails (unlike tearDown).'
        pass
    
    def addTypeEqualityFunc(self, typeobj, function):
        'Add a type specific assertEqual style function to compare a type.\n\n        This method is for use by TestCase subclasses that need to register\n        their own type equality functions to provide nicer error messages.\n\n        Args:\n            typeobj: The data type to call this function on when both values\n                    are of the same type in assertEqual().\n            function: The callable taking two arguments and an optional\n                    msg= argument that raises self.failureException with a\n                    useful error message when the two arguments are not equal.\n        '
        pass
    
    def assertAlmostEqual(self, first, second, places, msg, delta):
        'Fail if the two objects are unequal as determined by their\n           difference rounded to the given number of decimal places\n           (default 7) and comparing to zero, or by comparing that the\n           between the two objects is more than the given delta.\n\n           Note that decimal places (from zero) are usually not the same\n           as significant digits (measured from the most significant digit).\n\n           If the two objects compare equal then they will automatically\n           compare almost equal.\n        '
        pass
    
    def assertAlmostEquals(self, first, second, places, msg, delta):
        'Fail if the two objects are unequal as determined by their\n           difference rounded to the given number of decimal places\n           (default 7) and comparing to zero, or by comparing that the\n           between the two objects is more than the given delta.\n\n           Note that decimal places (from zero) are usually not the same\n           as significant digits (measured from the most significant digit).\n\n           If the two objects compare equal then they will automatically\n           compare almost equal.\n        '
        pass
    
    def assertDictContainsSubset(self, expected, actual, msg):
        'Checks whether actual is a superset of expected.'
        pass
    
    def assertDictEqual(self, d1, d2, msg):
        pass
    
    def assertEqual(self, first, second, msg):
        "Fail if the two objects are unequal as determined by the '=='\n           operator.\n        "
        pass
    
    def assertEquals(self, first, second, msg):
        "Fail if the two objects are unequal as determined by the '=='\n           operator.\n        "
        pass
    
    def assertFalse(self, expr, msg):
        'Check that the expression is false.'
        pass
    
    def assertGreater(self, a, b, msg):
        'Just like self.assertTrue(a > b), but with a nicer default message.'
        pass
    
    def assertGreaterEqual(self, a, b, msg):
        'Just like self.assertTrue(a >= b), but with a nicer default message.'
        pass
    
    def assertIn(self, member, container, msg):
        'Just like self.assertTrue(a in b), but with a nicer default message.'
        pass
    
    def assertIs(self, expr1, expr2, msg):
        'Just like self.assertTrue(a is b), but with a nicer default message.'
        pass
    
    def assertIsInstance(self, obj, cls, msg):
        'Same as self.assertTrue(isinstance(obj, cls)), with a nicer\n        default message.'
        pass
    
    def assertIsNone(self, obj, msg):
        'Same as self.assertTrue(obj is None), with a nicer default message.'
        pass
    
    def assertIsNot(self, expr1, expr2, msg):
        'Just like self.assertTrue(a is not b), but with a nicer default message.'
        pass
    
    def assertIsNotNone(self, obj, msg):
        'Included for symmetry with assertIsNone.'
        pass
    
    def assertItemsEqual(self, expected_seq, actual_seq, msg):
        'An unordered sequence specific comparison. It asserts that\n        actual_seq and expected_seq have the same element counts.\n        Equivalent to::\n\n            self.assertEqual(Counter(iter(actual_seq)),\n                             Counter(iter(expected_seq)))\n\n        Asserts that each element has the same count in both sequences.\n        Example:\n            - [0, 1, 1] and [1, 0, 1] compare equal.\n            - [0, 0, 1] and [0, 1] compare unequal.\n        '
        pass
    
    def assertLess(self, a, b, msg):
        'Just like self.assertTrue(a < b), but with a nicer default message.'
        pass
    
    def assertLessEqual(self, a, b, msg):
        'Just like self.assertTrue(a <= b), but with a nicer default message.'
        pass
    
    def assertListEqual(self, list1, list2, msg):
        'A list-specific equality assertion.\n\n        Args:\n            list1: The first list to compare.\n            list2: The second list to compare.\n            msg: Optional message to use on failure instead of a list of\n                    differences.\n\n        '
        pass
    
    def assertMultiLineEqual(self, first, second, msg):
        'Assert that two multi-line strings are equal.'
        pass
    
    def assertNotAlmostEqual(self, first, second, places, msg, delta):
        'Fail if the two objects are equal as determined by their\n           difference rounded to the given number of decimal places\n           (default 7) and comparing to zero, or by comparing that the\n           between the two objects is less than the given delta.\n\n           Note that decimal places (from zero) are usually not the same\n           as significant digits (measured from the most significant digit).\n\n           Objects that are equal automatically fail.\n        '
        pass
    
    def assertNotAlmostEquals(self, first, second, places, msg, delta):
        'Fail if the two objects are equal as determined by their\n           difference rounded to the given number of decimal places\n           (default 7) and comparing to zero, or by comparing that the\n           between the two objects is less than the given delta.\n\n           Note that decimal places (from zero) are usually not the same\n           as significant digits (measured from the most significant digit).\n\n           Objects that are equal automatically fail.\n        '
        pass
    
    def assertNotEqual(self, first, second, msg):
        "Fail if the two objects are equal as determined by the '!='\n           operator.\n        "
        pass
    
    def assertNotEquals(self, first, second, msg):
        "Fail if the two objects are equal as determined by the '!='\n           operator.\n        "
        pass
    
    def assertNotIn(self, member, container, msg):
        'Just like self.assertTrue(a not in b), but with a nicer default message.'
        pass
    
    def assertNotIsInstance(self, obj, cls, msg):
        'Included for symmetry with assertIsInstance.'
        pass
    
    def assertNotRegexpMatches(self, text, unexpected_regexp, msg):
        'Fail the test if the text matches the regular expression.'
        pass
    
    def assertRaises(self, excClass, callableObj, *args):
        "Fail unless an exception of class excClass is raised\n           by callableObj when invoked with arguments args and keyword\n           arguments kwargs. If a different type of exception is\n           raised, it will not be caught, and the test case will be\n           deemed to have suffered an error, exactly as for an\n           unexpected exception.\n\n           If called with callableObj omitted or None, will return a\n           context object used like this::\n\n                with self.assertRaises(SomeException):\n                    do_something()\n\n           The context manager keeps a reference to the exception as\n           the 'exception' attribute. This allows you to inspect the\n           exception after the assertion::\n\n               with self.assertRaises(SomeException) as cm:\n                   do_something()\n               the_exception = cm.exception\n               self.assertEqual(the_exception.error_code, 3)\n        "
        pass
    
    def assertRaisesRegexp(self, expected_exception, expected_regexp, callable_obj, *args):
        'Asserts that the message in a raised exception matches a regexp.\n\n        Args:\n            expected_exception: Exception class expected to be raised.\n            expected_regexp: Regexp (re pattern object or string) expected\n                    to be found in error message.\n            callable_obj: Function to be called.\n            args: Extra args.\n            kwargs: Extra kwargs.\n        '
        pass
    
    def assertRegexpMatches(self, text, expected_regexp, msg):
        'Fail the test unless the text matches the regular expression.'
        pass
    
    def assertSequenceEqual(self, seq1, seq2, msg, seq_type):
        'An equality assertion for ordered sequences (like lists and tuples).\n\n        For the purposes of this function, a valid ordered sequence type is one\n        which can be indexed, has a length, and has an equality operator.\n\n        Args:\n            seq1: The first sequence to compare.\n            seq2: The second sequence to compare.\n            seq_type: The expected datatype of the sequences, or None if no\n                    datatype should be enforced.\n            msg: Optional message to use on failure instead of a list of\n                    differences.\n        '
        pass
    
    def assertSetEqual(self, set1, set2, msg):
        'A set-specific equality assertion.\n\n        Args:\n            set1: The first set to compare.\n            set2: The second set to compare.\n            msg: Optional message to use on failure instead of a list of\n                    differences.\n\n        assertSetEqual uses ducktyping to support different types of sets, and\n        is optimized for sets specifically (parameters must support a\n        difference method).\n        '
        pass
    
    def assertTrue(self, expr, msg):
        'Check that the expression is true.'
        pass
    
    def assertTupleEqual(self, tuple1, tuple2, msg):
        'A tuple-specific equality assertion.\n\n        Args:\n            tuple1: The first tuple to compare.\n            tuple2: The second tuple to compare.\n            msg: Optional message to use on failure instead of a list of\n                    differences.\n        '
        pass
    
    def assert_(self, expr, msg):
        'Check that the expression is true.'
        pass
    
    def countTestCases(self):
        pass
    
    def debug(self):
        'Run the test without collecting errors in a TestResult'
        pass
    
    def defaultTestResult(self):
        pass
    
    def doCleanups(self):
        'Execute all cleanup functions. Normally called for you after\n        tearDown.'
        pass
    
    def fail(self, msg):
        'Fail immediately, with the given message.'
        pass
    
    def failIf(self, *args):
        pass
    
    def failIfAlmostEqual(self, *args):
        pass
    
    def failIfEqual(self, *args):
        pass
    
    def failUnless(self, *args):
        pass
    
    def failUnlessAlmostEqual(self, *args):
        pass
    
    def failUnlessEqual(self, *args):
        pass
    
    def failUnlessRaises(self, *args):
        pass
    
    def id(self):
        pass
    
    def run(self, result):
        pass
    
    def runTest(self):
        pass
    
    def setUp(self):
        pass
    
    def setUpClass(self, cls):
        'Hook method for setting up class fixture before running tests in the class.'
        pass
    
    def shortDescription(self):
        pass
    
    def skipTest(self, reason):
        'Skip this test.'
        pass
    
    def tearDown(self):
        pass
    
    def tearDownClass(self, cls):
        'Hook method for deconstructing the class fixture after running all tests in the class.'
        pass
    

class SkipTest(exceptions.Exception):
    '\n    Raise this exception in a test to skip it.\n\n    Usually you can use TestCase.skipTest() or one of the skipping decorators\n    instead of raising this directly.\n    '
    __class__ = SkipTest
    __dict__ = __builtin__.dict()
    __module__ = 'unittest.case'
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def __weakref__(self):
        'list of weak references to the object (if defined)'
        pass
    

class TestCase(__builtin__.object):
    "A class whose instances are single test cases.\n\n    By default, the test code itself should be placed in a method named\n    'runTest'.\n\n    If the fixture may be used for many test cases, create as\n    many test methods as are needed. When instantiating such a TestCase\n    subclass, specify in the constructor arguments the name of the test method\n    that the instance is to execute.\n\n    Test authors should subclass TestCase for their own tests. Construction\n    and deconstruction of the test's environment ('fixture') can be\n    implemented by overriding the 'setUp' and 'tearDown' methods respectively.\n\n    If it is necessary to override the __init__ method, the base class\n    __init__ method must always be called. It is important that subclasses\n    should not change the signature of their __init__ method, since instances\n    of the classes are instantiated automatically by parts of the framework\n    in order to be run.\n\n    When subclassing TestCase, you can set these attributes:\n    * failureException: determines which exception will be raised when\n        the instance's assertion methods fail; test methods raising this\n        exception will be deemed to have 'failed' rather than 'errored'.\n    * longMessage: determines whether long messages (including repr of\n        objects used in assert methods) will be printed on failure in *addition*\n        to any explicit message passed.\n    * maxDiff: sets the maximum length of a diff in failure messages\n        by assert methods using difflib. It is looked up as an instance\n        attribute so can be configured by individual tests if required.\n    "
    def __call__(self, *args):
        pass
    
    __class__ = TestCase
    __dict__ = __builtin__.dict()
    def __eq__(self, other):
        return False
    
    def __hash__(self):
        return 0
    
    def __init__(self, methodName):
        'Create an instance of the class that will use the named test\n           method when executed. Raises a ValueError if the instance does\n           not have a method with the specified name.\n        '
        pass
    
    __module__ = 'unittest.case'
    def __ne__(self, other):
        return False
    
    def __repr__(self):
        return ''
    
    def __str__(self):
        return ''
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def __weakref__(self):
        'list of weak references to the object (if defined)'
        pass
    
    def _addSkip(self, result, reason):
        pass
    
    def _baseAssertEqual(self, first, second, msg):
        'The default assertEqual implementation, not type specific.'
        pass
    
    _classSetupFailed = False
    def _deprecate(self, original_func):
        pass
    
    _diffThreshold = 65536
    def _formatMessage(self, msg, standardMsg):
        "Honour the longMessage attribute when generating failure messages.\n        If longMessage is False this means:\n        * Use only an explicit message if it is provided\n        * Otherwise use the standard message for the assert\n\n        If longMessage is True:\n        * Use the standard message\n        * If an explicit message is provided, plus ' : ' and the explicit message\n        "
        pass
    
    def _getAssertEqualityFunc(self, first, second):
        'Get a detailed comparison function for the types of the two args.\n\n        Returns: A callable accepting (first, second, msg=None) that will\n        raise a failure exception if first != second with a useful human\n        readable error message for those types.\n        '
        pass
    
    def _truncateMessage(self, message, diff):
        pass
    
    def addCleanup(self, function, *args):
        'Add a function, with arguments, to be called when the test is\n        completed. Functions added are called on a LIFO basis and are\n        called after tearDown on test failure or success.\n\n        Cleanup items are called even if setUp fails (unlike tearDown).'
        pass
    
    def addTypeEqualityFunc(self, typeobj, function):
        'Add a type specific assertEqual style function to compare a type.\n\n        This method is for use by TestCase subclasses that need to register\n        their own type equality functions to provide nicer error messages.\n\n        Args:\n            typeobj: The data type to call this function on when both values\n                    are of the same type in assertEqual().\n            function: The callable taking two arguments and an optional\n                    msg= argument that raises self.failureException with a\n                    useful error message when the two arguments are not equal.\n        '
        pass
    
    def assertAlmostEqual(self, first, second, places, msg, delta):
        'Fail if the two objects are unequal as determined by their\n           difference rounded to the given number of decimal places\n           (default 7) and comparing to zero, or by comparing that the\n           between the two objects is more than the given delta.\n\n           Note that decimal places (from zero) are usually not the same\n           as significant digits (measured from the most significant digit).\n\n           If the two objects compare equal then they will automatically\n           compare almost equal.\n        '
        pass
    
    def assertAlmostEquals(self, first, second, places, msg, delta):
        'Fail if the two objects are unequal as determined by their\n           difference rounded to the given number of decimal places\n           (default 7) and comparing to zero, or by comparing that the\n           between the two objects is more than the given delta.\n\n           Note that decimal places (from zero) are usually not the same\n           as significant digits (measured from the most significant digit).\n\n           If the two objects compare equal then they will automatically\n           compare almost equal.\n        '
        pass
    
    def assertDictContainsSubset(self, expected, actual, msg):
        'Checks whether actual is a superset of expected.'
        pass
    
    def assertDictEqual(self, d1, d2, msg):
        pass
    
    def assertEqual(self, first, second, msg):
        "Fail if the two objects are unequal as determined by the '=='\n           operator.\n        "
        pass
    
    def assertEquals(self, first, second, msg):
        "Fail if the two objects are unequal as determined by the '=='\n           operator.\n        "
        pass
    
    def assertFalse(self, expr, msg):
        'Check that the expression is false.'
        pass
    
    def assertGreater(self, a, b, msg):
        'Just like self.assertTrue(a > b), but with a nicer default message.'
        pass
    
    def assertGreaterEqual(self, a, b, msg):
        'Just like self.assertTrue(a >= b), but with a nicer default message.'
        pass
    
    def assertIn(self, member, container, msg):
        'Just like self.assertTrue(a in b), but with a nicer default message.'
        pass
    
    def assertIs(self, expr1, expr2, msg):
        'Just like self.assertTrue(a is b), but with a nicer default message.'
        pass
    
    def assertIsInstance(self, obj, cls, msg):
        'Same as self.assertTrue(isinstance(obj, cls)), with a nicer\n        default message.'
        pass
    
    def assertIsNone(self, obj, msg):
        'Same as self.assertTrue(obj is None), with a nicer default message.'
        pass
    
    def assertIsNot(self, expr1, expr2, msg):
        'Just like self.assertTrue(a is not b), but with a nicer default message.'
        pass
    
    def assertIsNotNone(self, obj, msg):
        'Included for symmetry with assertIsNone.'
        pass
    
    def assertItemsEqual(self, expected_seq, actual_seq, msg):
        'An unordered sequence specific comparison. It asserts that\n        actual_seq and expected_seq have the same element counts.\n        Equivalent to::\n\n            self.assertEqual(Counter(iter(actual_seq)),\n                             Counter(iter(expected_seq)))\n\n        Asserts that each element has the same count in both sequences.\n        Example:\n            - [0, 1, 1] and [1, 0, 1] compare equal.\n            - [0, 0, 1] and [0, 1] compare unequal.\n        '
        pass
    
    def assertLess(self, a, b, msg):
        'Just like self.assertTrue(a < b), but with a nicer default message.'
        pass
    
    def assertLessEqual(self, a, b, msg):
        'Just like self.assertTrue(a <= b), but with a nicer default message.'
        pass
    
    def assertListEqual(self, list1, list2, msg):
        'A list-specific equality assertion.\n\n        Args:\n            list1: The first list to compare.\n            list2: The second list to compare.\n            msg: Optional message to use on failure instead of a list of\n                    differences.\n\n        '
        pass
    
    def assertMultiLineEqual(self, first, second, msg):
        'Assert that two multi-line strings are equal.'
        pass
    
    def assertNotAlmostEqual(self, first, second, places, msg, delta):
        'Fail if the two objects are equal as determined by their\n           difference rounded to the given number of decimal places\n           (default 7) and comparing to zero, or by comparing that the\n           between the two objects is less than the given delta.\n\n           Note that decimal places (from zero) are usually not the same\n           as significant digits (measured from the most significant digit).\n\n           Objects that are equal automatically fail.\n        '
        pass
    
    def assertNotAlmostEquals(self, first, second, places, msg, delta):
        'Fail if the two objects are equal as determined by their\n           difference rounded to the given number of decimal places\n           (default 7) and comparing to zero, or by comparing that the\n           between the two objects is less than the given delta.\n\n           Note that decimal places (from zero) are usually not the same\n           as significant digits (measured from the most significant digit).\n\n           Objects that are equal automatically fail.\n        '
        pass
    
    def assertNotEqual(self, first, second, msg):
        "Fail if the two objects are equal as determined by the '!='\n           operator.\n        "
        pass
    
    def assertNotEquals(self, first, second, msg):
        "Fail if the two objects are equal as determined by the '!='\n           operator.\n        "
        pass
    
    def assertNotIn(self, member, container, msg):
        'Just like self.assertTrue(a not in b), but with a nicer default message.'
        pass
    
    def assertNotIsInstance(self, obj, cls, msg):
        'Included for symmetry with assertIsInstance.'
        pass
    
    def assertNotRegexpMatches(self, text, unexpected_regexp, msg):
        'Fail the test if the text matches the regular expression.'
        pass
    
    def assertRaises(self, excClass, callableObj, *args):
        "Fail unless an exception of class excClass is raised\n           by callableObj when invoked with arguments args and keyword\n           arguments kwargs. If a different type of exception is\n           raised, it will not be caught, and the test case will be\n           deemed to have suffered an error, exactly as for an\n           unexpected exception.\n\n           If called with callableObj omitted or None, will return a\n           context object used like this::\n\n                with self.assertRaises(SomeException):\n                    do_something()\n\n           The context manager keeps a reference to the exception as\n           the 'exception' attribute. This allows you to inspect the\n           exception after the assertion::\n\n               with self.assertRaises(SomeException) as cm:\n                   do_something()\n               the_exception = cm.exception\n               self.assertEqual(the_exception.error_code, 3)\n        "
        pass
    
    def assertRaisesRegexp(self, expected_exception, expected_regexp, callable_obj, *args):
        'Asserts that the message in a raised exception matches a regexp.\n\n        Args:\n            expected_exception: Exception class expected to be raised.\n            expected_regexp: Regexp (re pattern object or string) expected\n                    to be found in error message.\n            callable_obj: Function to be called.\n            args: Extra args.\n            kwargs: Extra kwargs.\n        '
        pass
    
    def assertRegexpMatches(self, text, expected_regexp, msg):
        'Fail the test unless the text matches the regular expression.'
        pass
    
    def assertSequenceEqual(self, seq1, seq2, msg, seq_type):
        'An equality assertion for ordered sequences (like lists and tuples).\n\n        For the purposes of this function, a valid ordered sequence type is one\n        which can be indexed, has a length, and has an equality operator.\n\n        Args:\n            seq1: The first sequence to compare.\n            seq2: The second sequence to compare.\n            seq_type: The expected datatype of the sequences, or None if no\n                    datatype should be enforced.\n            msg: Optional message to use on failure instead of a list of\n                    differences.\n        '
        pass
    
    def assertSetEqual(self, set1, set2, msg):
        'A set-specific equality assertion.\n\n        Args:\n            set1: The first set to compare.\n            set2: The second set to compare.\n            msg: Optional message to use on failure instead of a list of\n                    differences.\n\n        assertSetEqual uses ducktyping to support different types of sets, and\n        is optimized for sets specifically (parameters must support a\n        difference method).\n        '
        pass
    
    def assertTrue(self, expr, msg):
        'Check that the expression is true.'
        pass
    
    def assertTupleEqual(self, tuple1, tuple2, msg):
        'A tuple-specific equality assertion.\n\n        Args:\n            tuple1: The first tuple to compare.\n            tuple2: The second tuple to compare.\n            msg: Optional message to use on failure instead of a list of\n                    differences.\n        '
        pass
    
    def assert_(self, expr, msg):
        'Check that the expression is true.'
        pass
    
    def countTestCases(self):
        pass
    
    def debug(self):
        'Run the test without collecting errors in a TestResult'
        pass
    
    def defaultTestResult(self):
        pass
    
    def doCleanups(self):
        'Execute all cleanup functions. Normally called for you after\n        tearDown.'
        pass
    
    def fail(self, msg):
        'Fail immediately, with the given message.'
        pass
    
    def failIf(self, *args):
        pass
    
    def failIfAlmostEqual(self, *args):
        pass
    
    def failIfEqual(self, *args):
        pass
    
    def failUnless(self, *args):
        pass
    
    def failUnlessAlmostEqual(self, *args):
        pass
    
    def failUnlessEqual(self, *args):
        pass
    
    def failUnlessRaises(self, *args):
        pass
    
    failureException = exceptions.AssertionError
    def id(self):
        pass
    
    longMessage = False
    maxDiff = 640
    def run(self, result):
        pass
    
    def setUp(self):
        'Hook method for setting up the test fixture before exercising it.'
        pass
    
    def setUpClass(self, cls):
        'Hook method for setting up class fixture before running tests in the class.'
        pass
    
    def shortDescription(self):
        "Returns a one-line description of the test, or None if no\n        description has been provided.\n\n        The default implementation of this method returns the first line of\n        the specified test method's docstring.\n        "
        pass
    
    def skipTest(self, reason):
        'Skip this test.'
        pass
    
    def tearDown(self):
        'Hook method for deconstructing the test fixture after testing it.'
        pass
    
    def tearDownClass(self, cls):
        'Hook method for deconstructing the class fixture after running all tests in the class.'
        pass
    

class _AssertRaisesContext(__builtin__.object):
    'A context manager used to implement TestCase.assertRaises* methods.'
    __class__ = _AssertRaisesContext
    __dict__ = __builtin__.dict()
    def __enter__(self):
        pass
    
    def __exit__(self, exc_type, exc_value, tb):
        pass
    
    def __init__(self, expected, test_case, expected_regexp):
        pass
    
    __module__ = 'unittest.case'
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def __weakref__(self):
        'list of weak references to the object (if defined)'
        pass
    

class _ExpectedFailure(exceptions.Exception):
    '\n    Raise this when a test is expected to fail.\n\n    This is an implementation detail.\n    '
    __class__ = _ExpectedFailure
    __dict__ = __builtin__.dict()
    def __init__(self, exc_info):
        pass
    
    __module__ = 'unittest.case'
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def __weakref__(self):
        'list of weak references to the object (if defined)'
        pass
    

class _UnexpectedSuccess(exceptions.Exception):
    "\n    The test was supposed to fail, but it didn't!\n    "
    __class__ = _UnexpectedSuccess
    __dict__ = __builtin__.dict()
    __module__ = 'unittest.case'
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def __weakref__(self):
        'list of weak references to the object (if defined)'
        pass
    

__builtins__ = __builtin__.dict()
__doc__ = 'Test case implementation'
__file__ = 'C:\\PTVS\\packages\\python2.2.7.14\\tools\\lib\\unittest\\case.pyc'
__name__ = 'unittest.case'
__package__ = 'unittest'
__unittest = True
def _count_diff_all_purpose(actual, expected):
    'Returns list of (cnt_act, cnt_exp, elem) triples where the counts differ'
    pass

def _count_diff_hashable(actual, expected):
    'Returns list of (cnt_act, cnt_exp, elem) triples where the counts differ'
    pass

def _id(obj):
    pass

def expectedFailure(func):
    pass

def safe_repr(obj, short):
    pass

def skip(reason):
    '\n    Unconditionally skip a test.\n    '
    pass

def skipIf(condition, reason):
    '\n    Skip a test if the condition is true.\n    '
    pass

def skipUnless(condition, reason):
    '\n    Skip a test unless the condition is true.\n    '
    pass

def strclass(cls):
    pass

def unorderable_list_difference(expected, actual, ignore_duplicate):
    'Same behavior as sorted_list_difference but\n    for lists of unorderable items (like dicts).\n\n    As it does a linear search per item (remove) it\n    has O(n*n) performance.\n    '
    pass

