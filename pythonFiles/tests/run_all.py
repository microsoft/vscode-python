# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

# Replace the "." entry.
from tests.__main__ import main, parse_args
import os.path
import sys

sys.path[0] = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


if __name__ == "__main__":
    mainkwargs, pytestargs = parse_args()
    ec = main(pytestargs, **mainkwargs)
    sys.exit(ec)
