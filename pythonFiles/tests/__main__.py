# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os.path
import sys

import pytest


TEST_ROOT = os.path.dirname(__file__)
SRC_ROOT = os.path.dirname(TEST_ROOT)
DATASCIENCE_ROOT = os.path.join(SRC_ROOT, 'datascience')
TESTING_TOOLS_ROOT = os.path.join(SRC_ROOT, 'testing_tools')


def main(argv=sys.argv[1:]):
    sys.path.insert(1, DATASCIENCE_ROOT)
    sys.path.insert(1, TESTING_TOOLS_ROOT)
    ec = pytest.main([
        '--rootdir', SRC_ROOT,
        TEST_ROOT,
        ] + argv)
    return ec


if __name__ == '__main__':
    ec = main()
    sys.exit(ec)
