import __builtin__
import unittest.case
import unittest.loader
import unittest.main
import unittest.result
import unittest.runner
import unittest.suite

BaseTestSuite = unittest.suite.BaseTestSuite
FunctionTestCase = unittest.case.FunctionTestCase
SkipTest = unittest.case.SkipTest
TestCase = unittest.case.TestCase
TestLoader = unittest.loader.TestLoader
TestProgram = unittest.main.TestProgram
TestResult = unittest.result.TestResult
TestSuite = unittest.suite.TestSuite
TextTestResult = unittest.runner.TextTestResult
TextTestRunner = unittest.runner.TextTestRunner
_TextTestResult = unittest.runner.TextTestResult
__all__ = __builtin__.list()
__builtins__ = __builtin__.dict()
__doc__ = '\nPython unit testing framework, based on Erich Gamma\'s JUnit and Kent Beck\'s\nSmalltalk testing framework.\n\nThis module contains the core framework classes that form the basis of\nspecific test cases and suites (TestCase, TestSuite etc.), and also a\ntext-based utility class for running the tests and reporting the results\n (TextTestRunner).\n\nSimple usage:\n\n    import unittest\n\n    class IntegerArithmeticTestCase(unittest.TestCase):\n        def testAdd(self):  ## test method names begin \'test*\'\n            self.assertEqual((1 + 2), 3)\n            self.assertEqual(0 + 1, 1)\n        def testMultiply(self):\n            self.assertEqual((0 * 10), 0)\n            self.assertEqual((5 * 8), 40)\n\n    if __name__ == \'__main__\':\n        unittest.main()\n\nFurther information is available in the bundled documentation, and from\n\n  http://docs.python.org/library/unittest.html\n\nCopyright (c) 1999-2003 Steve Purcell\nCopyright (c) 2003-2010 Python Software Foundation\nThis module is free software, and you may redistribute it and/or modify\nit under the same terms as Python itself, so long as this copyright message\nand disclaimer are retained in their original form.\n\nIN NO EVENT SHALL THE AUTHOR BE LIABLE TO ANY PARTY FOR DIRECT, INDIRECT,\nSPECIAL, INCIDENTAL, OR CONSEQUENTIAL DAMAGES ARISING OUT OF THE USE OF\nTHIS CODE, EVEN IF THE AUTHOR HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH\nDAMAGE.\n\nTHE AUTHOR SPECIFICALLY DISCLAIMS ANY WARRANTIES, INCLUDING, BUT NOT\nLIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A\nPARTICULAR PURPOSE.  THE CODE PROVIDED HEREUNDER IS ON AN "AS IS" BASIS,\nAND THERE IS NO OBLIGATION WHATSOEVER TO PROVIDE MAINTENANCE,\nSUPPORT, UPDATES, ENHANCEMENTS, OR MODIFICATIONS.\n'
__file__ = 'C:\\PTVS\\packages\\python2.2.7.14\\tools\\lib\\unittest\\__init__.pyc'
__name__ = 'unittest'
__package__ = 'unittest'
__path__ = __builtin__.list()
__unittest = True
defaultTestLoader = unittest.loader.TestLoader()
def expectedFailure(func):
    pass

def findTestCases(module, prefix, sortUsing, suiteClass):
    pass

def getTestCaseNames(testCaseClass, prefix, sortUsing):
    pass

def installHandler():
    pass

main = unittest.main.TestProgram
def makeSuite(testCaseClass, prefix, sortUsing, suiteClass):
    pass

def registerResult(result):
    pass

def removeHandler(method):
    pass

def removeResult(result):
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

