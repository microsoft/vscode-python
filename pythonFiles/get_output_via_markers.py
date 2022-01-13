# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import runpy
import sys

# Sometimes executing scripts can print out stuff before the actual output is
# printed. For eg. when activating conda. Hence, printing out markers to make
# it more resilient to pull the output.
print(">>>PYTHON-EXEC-OUTPUT", end="")

module = sys.argv[1]
if module == "-c":
    ns = {}
    for code in sys.argv[2:]:
        exec(code, ns, ns)
elif module.startswith("-"):
    raise NotImplementedError(sys.argv)
elif module.endswith(".py"):
    runpy.run_path(module, run_name="__main__")
else:
    runpy.run_module(module, run_name="__main__", alter_sys=True)

print("<<<PYTHON-EXEC-OUTPUT", end="")
