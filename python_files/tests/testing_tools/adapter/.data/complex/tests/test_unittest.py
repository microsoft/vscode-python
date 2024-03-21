import unittest


class MyTests(unittest.TestCase):

    def test_simple(self):
        self.assertTrue(True)

    @unittest.skip('???')
    def test_skipped(self):
        self.assertTrue(False)

    @unittest.skipIf(True, '???')
    def test_maybe_skipped(self):
        self.assertTrue(False)

    @unittest.skipUnless(False, '???')
    def test_maybe_not_skipped(self):
        self.assertTrue(False)

    def test_skipped_inside(self):
        raise unittest.SkipTest('???')

    class TestSub1(object):

        def test_simple(self):
            self.assertTrue(True)

    class TestSub2(unittest.TestCase):

        def test_simple(self):
            self.assertTrue(True)

    def test_failure(self):
        raise Exception

    @unittest.expectedFailure
    def test_known_failure(self):
        raise Exception

    def test_with_subtests(self):
        for i in range(3):
            with self.subtest(i):  # This is invalid under Py2.
                self.assertTrue(True)

    def test_with_nested_subtests(self):
        for i in range(3):
            with self.subtest(i):  # This is invalid under Py2.
                for j in range(3):
                    with self.subtest(i):  # This is invalid under Py2.
                        self.assertTrue(True)

    for i in range(3):
        def test_dynamic_(self, i=i):
            self.assertEqual(True)
        test_dynamic_.__name__ += str(i)


class OtherTests(unittest.TestCase):

    def test_simple(self):
        self.assertTrue(True)


class NoTests(unittest.TestCase):
    pass
