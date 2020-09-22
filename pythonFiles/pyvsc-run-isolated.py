# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

if __name__ != "__main__":
    raise Exception("{} cannot be imported".format(__name__))

import os
import os.path
import runpy
import sys


def normalize(path):
    return os.path.normcase(os.path.normpath(path))


# We "isolate" the script/module (sys.argv[1]) by removing current working
# directory or '' in sys.path and then sending the target on to runpy.
cwd = normalize(os.getcwd())
sys.path[:] = (p for p in sys.path if p != "" and normalize(p) != cwd)
del sys.argv[0]
module = sys.argv[0]
if module == "-c":
    ns = {}
    for code in sys.argv[1:]:
        exec(code, ns, ns)
elif module.startswith("-"):
    raise NotImplementedError(sys.argv)
elif module.endswith(".py"):
    runpy.run_path(module, run_name="__main__")
else:
    runpy.run_module(module, run_name="__main__", alter_sys=True)
