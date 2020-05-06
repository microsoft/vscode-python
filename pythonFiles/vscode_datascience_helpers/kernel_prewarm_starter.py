"""Starts the python kernel the same way we would if we used the CLI.
IPykernel module must be run in the main thread, hence the blocking mechanism to
ready stdin to figure out when ipykernel needs to be started.
Running the module ipykernel effectively means we're starting the python kernel.
"""

# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

if __name__ != "__main__":
    raise Exception("{} cannot be imported".format(__name__))

import json
import runpy
import sys

# Assumption is ipykernel is available.
# Preload module (speed up, so when we really need it, it has already been loaded).
from ipykernel import kernelapp as app

# Block till we read somethign from `stdin`.
# As soon as we get something this is a trigger to start.
# The value passed into stdin would be the arguments we need to place into sys.argv.
input_json = sys.stdin.readline().strip()
sys.argv = json.loads(input_json)
module = sys.argv[0]

# Note, we must launch ipykenel in the main thread for kernel interrupt to work on windows.

# Start kernel in current process.
runpy.run_module(module, run_name="__main__", alter_sys=False)
