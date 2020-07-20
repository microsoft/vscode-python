# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

if __name__ != "__main__":
    raise Exception("{} cannot be imported".format(__name__))

import os.path
import runpy
import sys

# We "isolate" the script/module (sys.argv[1]) by
# replacing sys.path[0] with a dummy path and then sending the target
# on to runpy.
sys.path[0] = os.path.join(os.path.dirname(__file__), ".does-not-exist")
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
