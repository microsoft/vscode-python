# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os
import sys

# Last argument is the target file into which we'll write the env variables line by line.
output_file = sys.argv[-1]

with open(output_file, "w") as outfile:
    for key, val in os.environ.items():
        outfile.write(f"{key}={val}\n")
