import builtins
import logging

DIFF_OMITTED = '\nDiff is %s characters long. Set self.maxDiff to None to see it.'
class FunctionTestCase(TestCase):
    "A test case that wraps a test function.\n\n    This is useful for slipping pre-existing test functions into the\n    unittest framework. Optionally, set-up and tidy-up functions can be\n    supplied. As with TestCase, the tidy-up ('tearDown') function will\n    always be called if the set-up ('setUp') function ran successfully.\n    "
    __class__ = FunctionTestCase
    __dict__ = builtins.dict()
    def __eq__(self, other):
        pass
    
    def __hash__(self):
        pass
    
    def __init__(self, testFunc, setUp, tearDown, description):
        pass
    
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    def __repr__(self):
        pass
    
    def __str__(self):
        pass
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def id(self):
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
    
    def tearDown(self):
        pass
    
    def tearDownClass(self, cls):
        'Hook method for deconstructing the class fixture after running all tests in the class.'
        pass
    

class SkipTest(builtins.Exception):
    '\n    Raise this exception in a test to skip it.\n\n    Usually you can use TestCase.skipTest() or one of the skipping decorators\n    instead of raising this directly.\n    '
    __class__ = SkipTest
    __dict__ = builtins.dict()
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    __module__ = 'unittest.case'
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def __weakref__(self):
        'list of weak references to the object (if defined)'
        pass
    

class TestCase(builtins.object):
    "A class whose instances are single test cases.\n\n    By default, the test code itself should be placed in a method named\n    'runTest'.\n\n    If the fixture may be used for many test cases, create as\n    many test methods as are needed. When instantiating such a TestCase\n    subclass, specify in the constructor arguments the name of the test method\n    that the instance is to execute.\n\n    Test authors should subclass TestCase for their own tests. Construction\n    and deconstruction of the test's environment ('fixture') can be\n    implemented by overriding the 'setUp' and 'tearDown' methods respectively.\n\n    If it is necessary to override the __init__ method, the base class\n    __init__ method must always be called. It is important that subclasses\n    should not change the signature of their __init__ method, since instances\n    of the classes are instantiated automatically by parts of the framework\n    in order to be run.\n\n    When subclassing TestCase, you can set these attributes:\n    * failureException: determines which exception will be raised when\n        the instance's assertion methods fail; test methods raising this\n        exception will be deemed to have 'failed' rather than 'errored'.\n    * longMessage: determines whether long messages (including repr of\n        objects used in assert methods) will be printed on failure in *addition*\n        to any explicit message passed.\n    * maxDiff: sets the maximum length of a diff in failure messages\n        by assert methods using difflib. It is looked up as an instance\n        attribute so can be configured by individual tests if required.\n    "
    def __call__(self, *args, **kwds):
        pass
    
    __class__ = TestCase
    __dict__ = builtins.dict()
    def __eq__(self, other):
        pass
    
    def __hash__(self):
        pass
    
    def __init__(self, methodName):
        'Create an instance of the class that will use the named test\n           method when executed. Raises a ValueError if the instance does\n           not have a method with the specified name.\n        '
        pass
    
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    __module__ = 'unittest.case'
    def __repr__(self):
        pass
    
    def __str__(self):
        pass
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def __weakref__(self):
        'list of weak references to the object (if defined)'
        pass
    
    def _addExpectedFailure(self, result, exc_info):
        pass
    
    def _addSkip(self, result, test_case, reason):
        pass
    
    def _addUnexpectedSuccess(self, result):
        pass
    
    def _baseAssertEqual(self, first, second, msg):
        'The default assertEqual implementation, not type specific.'
        pass
    
    _classSetupFailed = False
    def _deprecate(self, original_func):
        pass
    
    _diffThreshold = 65536
    def _feedErrorsToResult(self, result, errors):
        pass
    
    def _formatMessage(self, msg, standardMsg):
        "Honour the longMessage attribute when generating failure messages.\n        If longMessage is False this means:\n        * Use only an explicit message if it is provided\n        * Otherwise use the standard message for the assert\n\n        If longMessage is True:\n        * Use the standard message\n        * If an explicit message is provided, plus ' : ' and the explicit message\n        "
        pass
    
    def _getAssertEqualityFunc(self, first, second):
        'Get a detailed comparison function for the types of the two args.\n\n        Returns: A callable accepting (first, second, msg=None) that will\n        raise a failure exception if first != second with a useful human\n        readable error message for those types.\n        '
        pass
    
    def _truncateMessage(self, message, diff):
        pass
    
    def addCleanup(self, function, *args, **kwargs):
        'Add a function, with arguments, to be called when the test is\n        completed. Functions added are called on a LIFO basis and are\n        called after tearDown on test failure or success.\n\n        Cleanup items are called even if setUp fails (unlike tearDown).'
        pass
    
    def addTypeEqualityFunc(self, typeobj, function):
        'Add a type specific assertEqual style function to compare a type.\n\n        This method is for use by TestCase subclasses that need to register\n        their own type equality functions to provide nicer error messages.\n\n        Args:\n            typeobj: The data type to call this function on when both values\n                    are of the same type in assertEqual().\n            function: The callable taking two arguments and an optional\n                    msg= argument that raises self.failureException with a\n                    useful error message when the two arguments are not equal.\n        '
        pass
    
    def assertAlmostEqual(self, first, second, places, msg, delta):
        'Fail if the two objects are unequal as determined by their\n           difference rounded to the given number of decimal places\n           (default 7) and comparing to zero, or by comparing that the\n           difference between the two objects is more than the given\n           delta.\n\n           Note that decimal places (from zero) are usually not the same\n           as significant digits (measured from the most significant digit).\n\n           If the two objects compare equal then they will automatically\n           compare almost equal.\n        '
        pass
    
    def assertAlmostEquals(self, *args, **kwargs):
        pass
    
    def assertCountEqual(self, first, second, msg):
        'An unordered sequence comparison asserting that the same elements,\n        regardless of order.  If the same element occurs more than once,\n        it verifies that the elements occur the same number of times.\n\n            self.assertEqual(Counter(list(first)),\n                             Counter(list(second)))\n\n         Example:\n            - [0, 1, 1] and [1, 0, 1] compare equal.\n            - [0, 0, 1] and [0, 1] compare unequal.\n\n        '
        pass
    
    def assertDictContainsSubset(self, subset, dictionary, msg):
        'Checks whether dictionary is a superset of subset.'
        pass
    
    def assertDictEqual(self, d1, d2, msg):
        pass
    
    def assertEqual(self, first, second, msg):
        "Fail if the two objects are unequal as determined by the '=='\n           operator.\n        "
        pass
    
    def assertEquals(self, *args, **kwargs):
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
    
    def assertLess(self, a, b, msg):
        'Just like self.assertTrue(a < b), but with a nicer default message.'
        pass
    
    def assertLessEqual(self, a, b, msg):
        'Just like self.assertTrue(a <= b), but with a nicer default message.'
        pass
    
    def assertListEqual(self, list1, list2, msg):
        'A list-specific equality assertion.\n\n        Args:\n            list1: The first list to compare.\n            list2: The second list to compare.\n            msg: Optional message to use on failure instead of a list of\n                    differences.\n\n        '
        pass
    
    def assertLogs(self, logger, level):
        "Fail unless a log message of level *level* or higher is emitted\n        on *logger_name* or its children.  If omitted, *level* defaults to\n        INFO and *logger* defaults to the root logger.\n\n        This method must be used as a context manager, and will yield\n        a recording object with two attributes: `output` and `records`.\n        At the end of the context manager, the `output` attribute will\n        be a list of the matching formatted log messages and the\n        `records` attribute will be a list of the corresponding LogRecord\n        objects.\n\n        Example::\n\n            with self.assertLogs('foo', level='INFO') as cm:\n                logging.getLogger('foo').info('first message')\n                logging.getLogger('foo.bar').error('second message')\n            self.assertEqual(cm.output, ['INFO:foo:first message',\n                                         'ERROR:foo.bar:second message'])\n        "
        pass
    
    def assertMultiLineEqual(self, first, second, msg):
        'Assert that two multi-line strings are equal.'
        pass
    
    def assertNotAlmostEqual(self, first, second, places, msg, delta):
        'Fail if the two objects are equal as determined by their\n           difference rounded to the given number of decimal places\n           (default 7) and comparing to zero, or by comparing that the\n           difference between the two objects is less than the given delta.\n\n           Note that decimal places (from zero) are usually not the same\n           as significant digits (measured from the most significant digit).\n\n           Objects that are equal automatically fail.\n        '
        pass
    
    def assertNotAlmostEquals(self, *args, **kwargs):
        pass
    
    def assertNotEqual(self, first, second, msg):
        "Fail if the two objects are equal as determined by the '!='\n           operator.\n        "
        pass
    
    def assertNotEquals(self, *args, **kwargs):
        pass
    
    def assertNotIn(self, member, container, msg):
        'Just like self.assertTrue(a not in b), but with a nicer default message.'
        pass
    
    def assertNotIsInstance(self, obj, cls, msg):
        'Included for symmetry with assertIsInstance.'
        pass
    
    def assertNotRegex(self, text, unexpected_regex, msg):
        'Fail the test if the text matches the regular expression.'
        pass
    
    def assertNotRegexpMatches(self, *args, **kwargs):
        pass
    
    def assertRaises(self, expected_exception, *args, **kwargs):
        "Fail unless an exception of class expected_exception is raised\n           by the callable when invoked with specified positional and\n           keyword arguments. If a different type of exception is\n           raised, it will not be caught, and the test case will be\n           deemed to have suffered an error, exactly as for an\n           unexpected exception.\n\n           If called with the callable and arguments omitted, will return a\n           context object used like this::\n\n                with self.assertRaises(SomeException):\n                    do_something()\n\n           An optional keyword argument 'msg' can be provided when assertRaises\n           is used as a context object.\n\n           The context manager keeps a reference to the exception as\n           the 'exception' attribute. This allows you to inspect the\n           exception after the assertion::\n\n               with self.assertRaises(SomeException) as cm:\n                   do_something()\n               the_exception = cm.exception\n               self.assertEqual(the_exception.error_code, 3)\n        "
        pass
    
    def assertRaisesRegex(self, expected_exception, expected_regex, *args, **kwargs):
        'Asserts that the message in a raised exception matches a regex.\n\n        Args:\n            expected_exception: Exception class expected to be raised.\n            expected_regex: Regex (re pattern object or string) expected\n                    to be found in error message.\n            args: Function to be called and extra positional args.\n            kwargs: Extra kwargs.\n            msg: Optional message used in case of failure. Can only be used\n                    when assertRaisesRegex is used as a context manager.\n        '
        pass
    
    def assertRaisesRegexp(self, *args, **kwargs):
        pass
    
    def assertRegex(self, text, expected_regex, msg):
        'Fail the test unless the text matches the regular expression.'
        pass
    
    def assertRegexpMatches(self, *args, **kwargs):
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
    
    def assertWarns(self, expected_warning, *args, **kwargs):
        "Fail unless a warning of class warnClass is triggered\n           by the callable when invoked with specified positional and\n           keyword arguments.  If a different type of warning is\n           triggered, it will not be handled: depending on the other\n           warning filtering rules in effect, it might be silenced, printed\n           out, or raised as an exception.\n\n           If called with the callable and arguments omitted, will return a\n           context object used like this::\n\n                with self.assertWarns(SomeWarning):\n                    do_something()\n\n           An optional keyword argument 'msg' can be provided when assertWarns\n           is used as a context object.\n\n           The context manager keeps a reference to the first matching\n           warning as the 'warning' attribute; similarly, the 'filename'\n           and 'lineno' attributes give you information about the line\n           of Python code from which the warning was triggered.\n           This allows you to inspect the warning after the assertion::\n\n               with self.assertWarns(SomeWarning) as cm:\n                   do_something()\n               the_warning = cm.warning\n               self.assertEqual(the_warning.some_attribute, 147)\n        "
        pass
    
    def assertWarnsRegex(self, expected_warning, expected_regex, *args, **kwargs):
        'Asserts that the message in a triggered warning matches a regexp.\n        Basic functioning is similar to assertWarns() with the addition\n        that only warnings whose messages also match the regular expression\n        are considered successful matches.\n\n        Args:\n            expected_warning: Warning class expected to be triggered.\n            expected_regex: Regex (re pattern object or string) expected\n                    to be found in error message.\n            args: Function to be called and extra positional args.\n            kwargs: Extra kwargs.\n            msg: Optional message used in case of failure. Can only be used\n                    when assertWarnsRegex is used as a context manager.\n        '
        pass
    
    def assert_(self, *args, **kwargs):
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
    
    def failIf(self, *args, **kwargs):
        pass
    
    def failIfAlmostEqual(self, *args, **kwargs):
        pass
    
    def failIfEqual(self, *args, **kwargs):
        pass
    
    def failUnless(self, *args, **kwargs):
        pass
    
    def failUnlessAlmostEqual(self, *args, **kwargs):
        pass
    
    def failUnlessEqual(self, *args, **kwargs):
        pass
    
    def failUnlessRaises(self, *args, **kwargs):
        pass
    
    failureException = builtins.AssertionError
    def id(self):
        pass
    
    longMessage = True
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
    
    def subTest(self, *args, **kwds):
        'Return a context manager that will return the enclosed block\n        of code in a subtest identified by the optional message and\n        keyword parameters.  A failure in the subtest marks the test\n        case as failed but resumes execution at the end of the enclosed\n        block, allowing further test code to be executed.\n        '
        pass
    
    def tearDown(self):
        'Hook method for deconstructing the test fixture after testing it.'
        pass
    
    def tearDownClass(self, cls):
        'Hook method for deconstructing the class fixture after running all tests in the class.'
        pass
    

class _AssertLogsContext(_BaseTestCaseContext):
    'A context manager used to implement TestCase.assertLogs().'
    LOGGING_FORMAT = '%(levelname)s:%(name)s:%(message)s'
    __class__ = _AssertLogsContext
    __dict__ = builtins.dict()
    def __enter__(self):
        pass
    
    def __exit__(self, exc_type, exc_value, tb):
        pass
    
    def __init__(self, test_case, logger_name, level):
        pass
    
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    

class _AssertRaisesBaseContext(_BaseTestCaseContext):
    __class__ = _AssertRaisesBaseContext
    __dict__ = builtins.dict()
    def __init__(self, expected, test_case, expected_regex):
        pass
    
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def handle(self, name, args, kwargs):
        "\n        If args is empty, assertRaises/Warns is being used as a\n        context manager, so check for a 'msg' kwarg and return self.\n        If args is not empty, call a callable passing positional and keyword\n        arguments.\n        "
        pass
    

class _AssertRaisesContext(_AssertRaisesBaseContext):
    'A context manager used to implement TestCase.assertRaises* methods.'
    __class__ = _AssertRaisesContext
    __dict__ = builtins.dict()
    def __enter__(self):
        pass
    
    def __exit__(self, exc_type, exc_value, tb):
        pass
    
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    _base_type = builtins.BaseException
    _base_type_str = 'an exception type or tuple of exception types'

class _AssertWarnsContext(_AssertRaisesBaseContext):
    'A context manager used to implement TestCase.assertWarns* methods.'
    __class__ = _AssertWarnsContext
    __dict__ = builtins.dict()
    def __enter__(self):
        pass
    
    def __exit__(self, exc_type, exc_value, tb):
        pass
    
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    _base_type = builtins.Warning
    _base_type_str = 'a warning type or tuple of warning types'

class _BaseTestCaseContext(builtins.object):
    __class__ = _BaseTestCaseContext
    __dict__ = builtins.dict()
    def __init__(self, test_case):
        pass
    
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    __module__ = 'unittest.case'
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def __weakref__(self):
        'list of weak references to the object (if defined)'
        pass
    
    def _raiseFailure(self, standardMsg):
        pass
    

class _CapturingHandler(logging.Handler):
    '\n    A logging handler capturing all (raw and formatted) logging output.\n    '
    __class__ = _CapturingHandler
    __dict__ = builtins.dict()
    def __init__(self):
        pass
    
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    __module__ = 'unittest.case'
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def emit(self, record):
        pass
    
    def flush(self):
        pass
    

class _LoggingWatcher(builtins.tuple):
    '_LoggingWatcher(records, output)'
    __class__ = _LoggingWatcher
    def __getnewargs__(self):
        'Return self as a plain tuple.  Used by copy and pickle.'
        pass
    
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    __module__ = 'unittest.case'
    def __repr__(self):
        'Return a nicely formatted representation string'
        pass
    
    __slots__ = builtins.tuple()
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def _asdict(self):
        'Return a new OrderedDict which maps field names to their values.'
        pass
    
    _fields = builtins.tuple()
    def _make(self, cls, iterable, new, len):
        'Make a new _LoggingWatcher object from a sequence or iterable'
        pass
    
    def _replace(self, _self, **kwds):
        'Return a new _LoggingWatcher object replacing specified fields with new values'
        pass
    
    _source = "from builtins import property as _property, tuple as _tuple\nfrom operator import itemgetter as _itemgetter\nfrom collections import OrderedDict\n\nclass _LoggingWatcher(tuple):\n    '_LoggingWatcher(records, output)'\n\n    __slots__ = ()\n\n    _fields = ('records', 'output')\n\n    def __new__(_cls, records, output):\n        'Create new instance of _LoggingWatcher(records, output)'\n        return _tuple.__new__(_cls, (records, output))\n\n    @classmethod\n    def _make(cls, iterable, new=tuple.__new__, len=len):\n        'Make a new _LoggingWatcher object from a sequence or iterable'\n        result = new(cls, iterable)\n        if len(result) != 2:\n            raise TypeError('Expected 2 arguments, got %d' % len(result))\n        return result\n\n    def _replace(_self, **kwds):\n        'Return a new _LoggingWatcher object replacing specified fields with new values'\n        result = _self._make(map(kwds.pop, ('records', 'output'), _self))\n        if kwds:\n            raise ValueError('Got unexpected field names: %r' % list(kwds))\n        return result\n\n    def __repr__(self):\n        'Return a nicely formatted representation string'\n        return self.__class__.__name__ + '(records=%r, output=%r)' % self\n\n    def _asdict(self):\n        'Return a new OrderedDict which maps field names to their values.'\n        return OrderedDict(zip(self._fields, self))\n\n    def __getnewargs__(self):\n        'Return self as a plain tuple.  Used by copy and pickle.'\n        return tuple(self)\n\n    records = _property(_itemgetter(0), doc='Alias for field number 0')\n\n    output = _property(_itemgetter(1), doc='Alias for field number 1')\n\n"
    output = builtins.property()
    records = builtins.property()

class _Outcome(builtins.object):
    __class__ = _Outcome
    __dict__ = builtins.dict()
    def __init__(self, result):
        pass
    
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    __module__ = 'unittest.case'
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def __weakref__(self):
        'list of weak references to the object (if defined)'
        pass
    
    def testPartExecutor(self, *args, **kwds):
        pass
    

class _ShouldStop(builtins.Exception):
    '\n    The test should stop.\n    '
    __class__ = _ShouldStop
    __dict__ = builtins.dict()
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    __module__ = 'unittest.case'
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def __weakref__(self):
        'list of weak references to the object (if defined)'
        pass
    

class _SubTest(TestCase):
    __class__ = _SubTest
    __dict__ = builtins.dict()
    def __init__(self, test_case, message, params):
        pass
    
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    def __str__(self):
        pass
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def _subDescription(self):
        pass
    
    def id(self):
        pass
    
    def runTest(self):
        pass
    
    def setUpClass(self, cls):
        'Hook method for setting up class fixture before running tests in the class.'
        pass
    
    def shortDescription(self):
        'Returns a one-line description of the subtest, or None if no\n        description has been provided.\n        '
        pass
    
    def tearDownClass(self, cls):
        'Hook method for deconstructing the class fixture after running all tests in the class.'
        pass
    

class _UnexpectedSuccess(builtins.Exception):
    "\n    The test was supposed to fail, but it didn't!\n    "
    __class__ = _UnexpectedSuccess
    __dict__ = builtins.dict()
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    __module__ = 'unittest.case'
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def __weakref__(self):
        'list of weak references to the object (if defined)'
        pass
    

__builtins__ = builtins.dict()
__cached__ = 'C:\\PTVS\\packages\\python\\tools\\lib\\unittest\\__pycache__\\case.cpython-36.pyc'
__doc__ = 'Test case implementation'
__file__ = 'C:\\PTVS\\packages\\python\\tools\\lib\\unittest\\case.py'
__name__ = 'unittest.case'
__package__ = 'unittest'
__unittest = True
def _common_shorten_repr(*args):
    pass

def _count_diff_all_purpose(actual, expected):
    'Returns list of (cnt_act, cnt_exp, elem) triples where the counts differ'
    pass

def _count_diff_hashable(actual, expected):
    'Returns list of (cnt_act, cnt_exp, elem) triples where the counts differ'
    pass

def _id(obj):
    pass

def _is_subtype(expected, basetype):
    pass

_subtest_msg_sentinel = builtins.object()
def expectedFailure(test_item):
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

