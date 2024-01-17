# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

# Replace the "." entry.
import os
import sys
from pathlib import Path

sys.path[0] = os.fspath(Path(__file__).resolve().parent.parent)

from tests.__main__ import main, parse_args


if __name__ == "__main__":
    mainkwargs, pytestargs = parse_args()
    ec = main(pytestargs, **mainkwargs)
    sys.exit(ec)
