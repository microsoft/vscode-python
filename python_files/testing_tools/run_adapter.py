# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

# Replace the "." entry.
import os
import pathlib
import sys

sys.path.insert(
    1,
    os.fsdecode(pathlib.Path(__file__).parent.parent),
)

from testing_tools.adapter.__main__ import main, parse_args

if __name__ == "__main__":
    tool, cmd, subargs, toolargs = parse_args()
    main(tool, cmd, subargs, toolargs)
