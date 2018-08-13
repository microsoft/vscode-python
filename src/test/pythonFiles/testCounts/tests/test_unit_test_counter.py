import unittest


class UnitTestCounts(unittest.TestCase):

    def test_gimmeFailure(self):
        self.assertEqual(1, 2, '1 != 2, this should definitely have failed.')

    def test_gimmeSuccess(self):
        self.assertNotEqual(1, 2, 'wtf, one does not equal two.')

    def test_doubleUpTheFail(self):
        self.assertGreater(1, 2, 'This should have failed as 1 is always < 2.')

    def test_gimmeMoreSuccess(self):
        self.assertFalse(1 == 2, '1 and 2 are not the same. What gives.')
