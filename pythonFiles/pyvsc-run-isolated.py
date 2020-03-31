# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

if __name__ != "__main__":
    raise Exception("{} cannot be imported".format(__name__))

import runpy
import sys

# We "isolate" the script/module (sys.argv[1]) by
# deleting sys.path[0] and then sending the target
# on to runpy.
del sys.path[0]
del sys.argv[0]
module = sys.argv[0]
if module.endswith(".py"):
    runpy.run_path(module)
else:
    runpy.run_module(module, alter_sys=True)
