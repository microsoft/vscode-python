import os.path
import sys

import pytest


TEST_ROOT = os.path.dirname(__file__)
SRC_ROOT = os.path.dirname(TEST_ROOT)
DATASCIENCE_ROOT = os.path.join(SRC_ROOT, 'datascience')


if __name__ == '__main__':
    sys.path.insert(1, DATASCIENCE_ROOT)
    ec = pytest.main([
        '--rootdir', SRC_ROOT,
        TEST_ROOT,
        ])
    sys.exit(ec)
