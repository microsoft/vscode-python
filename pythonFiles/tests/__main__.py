# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import argparse
import os.path
import sys

import pytest


TEST_ROOT = os.path.dirname(__file__)
SRC_ROOT = os.path.dirname(TEST_ROOT)
PROJECT_ROOT = os.path.dirname(SRC_ROOT)
DATASCIENCE_ROOT = os.path.join(SRC_ROOT, 'datascience')
TESTING_TOOLS_ROOT = os.path.join(SRC_ROOT, 'testing_tools')


def parse_args():
    parser = argparse.ArgumentParser()
    # To mark a test as functional:  (decorator) @pytest.mark.functional
    parser.add_argument('--functional', dest='markers',
                        action='append_const', const='functional')
    parser.add_argument('--no-functional', dest='markers',
                        action='append_const', const='not functional')
    args, remainder = parser.parse_known_args()

    ns = vars(args)

    return ns, remainder


def main(pytestargs, markers=None):
    sys.path.insert(1, DATASCIENCE_ROOT)
    sys.path.insert(1, TESTING_TOOLS_ROOT)

    pytestargs = [
        '--rootdir', SRC_ROOT,
        TEST_ROOT,
        ] + pytestargs
    for marker in reversed(markers or ()):
        pytestargs.insert(0, marker)
        pytestargs.insert(0, '-m')

    ec = pytest.main(pytestargs)
    return ec


if __name__ == '__main__':
    mainkwargs, pytestargs = parse_args()
    ec = main(pytestargs, **mainkwargs)
    sys.exit(ec)
