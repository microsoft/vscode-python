# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

# Replace the "." entry.
import os
import sys
from pathlib import Path

sys.path.insert(1, os.fspath(Path(__file__).resolve().parent.parent))

from testing_tools.adapter.__main__ import parse_args, main


if __name__ == "__main__":
    tool, cmd, subargs, toolargs = parse_args()
    main(tool, cmd, subargs, toolargs)
