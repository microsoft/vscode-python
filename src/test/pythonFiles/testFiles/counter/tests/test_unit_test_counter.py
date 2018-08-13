import unittest


class UnitTestCounts(unittest.TestCase):
    """Tests for ensuring the counter in the status bar is correct for unit tests."""
    
    def test_assured_fail(self):
        self.assertEqual(1, 2, 'This test is intended to fail.')

    def test_assured_success(self):
        self.assertNotEqual(1, 2, 'This test is intended to not fail. (1 == 2 should never be equal)')

    def test_assured_fail_2(self):
        self.assertGreater(1, 2, 'This test is intended to fail.')

    def test_assured_success_2(self):
        self.assertFalse(1 == 2, 'This test is intended to not fail. (1 == 2 should always be false)')
