import unittest

from adapter.report import discovered


class DiscoveredTests(unittest.TestCase):

    def test_basic(self):
        data = object()
        with self.assertRaises(NotImplementedError):
            discovered(data)
