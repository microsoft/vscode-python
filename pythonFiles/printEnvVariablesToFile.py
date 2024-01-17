# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os
import pathlib
import sys

# Last argument is the target file into which we'll write the env variables line by line.
output_file = pathlib.Path(sys.argv[-1])

with output_file.open("w") as outfile:
    for key, val in os.environ.items():
        outfile.write(f"{key}={val}\n")
