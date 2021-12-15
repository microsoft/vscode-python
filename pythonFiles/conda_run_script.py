# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

if __name__ != "__main__":
    raise Exception("{} cannot be imported".format(__name__))

import runpy
import sys

# Activating conda can print out stuff before the actual output is
# printed. Hence, printing out markers to make it more resilient to
# pull the output.
print(">>>CONDARUNOUTPUT", end="")

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

print("<<<CONDARUNOUTPUT", end="")
