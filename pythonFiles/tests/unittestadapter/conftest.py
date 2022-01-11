# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import sys

# Ignore the contents of this folder for Python2 tests.
collect_ignore = []
if sys.version_info[0] < 3:
    collect_ignore.append(".")
