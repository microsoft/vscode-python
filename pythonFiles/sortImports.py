# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import io
import os
import os.path
import sys

isort_path = os.path.join(os.path.dirname(__file__), "lib", "python")
sys.path.insert(0, isort_path)

# Work around stdin buffering issues on windows (https://bugs.python.org/issue40540)
# caused in part by isort seeking within the stdin stream by replacing the
# stream with something which is definitely seekable.
try:
    # python 3
    stdin = sys.stdin.buffer
except AttributeError:
    # python 2
    stdin = sys.stdin

sys.stdin = io.BytesIO(stdin.read())
# End workaround

import isort.main

isort.main.main()
