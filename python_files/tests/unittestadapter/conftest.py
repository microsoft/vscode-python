# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import sys

# Ignore the contents of this folder for Python 2 tests.
if sys.version_info[0] < 3:
    collect_ignore_glob = ["*.py"]
