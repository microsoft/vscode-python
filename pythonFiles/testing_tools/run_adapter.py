# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

# Replace the "." entry.
import os.path
import sys

sys.path.insert(
    1,
    os.path.dirname(  # pythonFiles
        os.path.dirname(  # pythonFiles/testing_tools
            os.path.abspath(__file__)  # this file
        )
    ),
)

from testing_tools.adapter.__main__ import main, parse_args

if __name__ == "__main__":
    tool, cmd, subargs, toolargs = parse_args()
    main(tool, cmd, subargs, toolargs)
    print("run adapter hello")
