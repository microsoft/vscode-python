import unittest

from adapter.pytest import discover


class DiscoverTests(unittest.TestCase):

    def test_basic(self):
        with self.assertRaises(NotImplementedError):
            discover()

