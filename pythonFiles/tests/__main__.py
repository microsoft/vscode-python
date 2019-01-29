import os.path
import sys
import unittest


TEST_ROOT = os.path.dirname(__file__)
SRC_ROOT = os.path.dirname(TEST_ROOT)
DATASCIENCE_ROOT = os.path.join(SRC_ROOT, 'datascience')


if __name__ == '__main__':
    sys.path.insert(1, DATASCIENCE_ROOT)
    suite = unittest.defaultTestLoader.discover(TEST_ROOT,
                                                top_level_dir=SRC_ROOT)
    unittest.TextTestRunner(verbosity=2).run(suite)
