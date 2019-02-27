import os.path
import sys

import pytest


TEST_ROOT = os.path.dirname(__file__)
SRC_ROOT = os.path.dirname(TEST_ROOT)
DATASCIENCE_ROOT = os.path.join(SRC_ROOT, 'datascience')
TESTING_TOOLS_ROOT = os.path.join(SRC_ROOT, 'testing_tools')


if __name__ == '__main__':
    sys.path.insert(1, DATASCIENCE_ROOT)
    sys.path.insert(1, TESTING_TOOLS_ROOT)
    ec = pytest.main([
        '--rootdir', SRC_ROOT,
        TEST_ROOT,
        ] + sys.argv[1:])
    sys.exit(ec)
