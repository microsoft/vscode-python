# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os
import pathlib
import sys

sys.path.append(os.fspath(pathlib.Path(__file__).parent.parent))

from unittestadapter.django_handler import django_execution_runner

if __name__ == "__main__":
    args = sys.argv[1:]
    manage_py_path = args[0]
    remaining = args[1:]
    if "--" in remaining:
        separator_index = remaining.index("--")
        extra_args = remaining[:separator_index]
        test_ids = remaining[separator_index + 1 :]
    else:
        extra_args = []
        test_ids = remaining
    django_execution_runner(manage_py_path, test_ids, extra_args)
