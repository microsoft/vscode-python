import unittest

from testing_tools.adapter.discover import report


class ReportTests(unittest.TestCase):

    def test_basic(self):
        data = object()
        with self.assertRaises(NotImplementedError):
            report(data)
