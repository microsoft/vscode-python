# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os
import os.path
import platform
import sys
import traceback
from .install_ptvsd import get_folder_tag

useCustomPtvsd = sys.argv[1] == '--custom'
ptvsdArgs = sys.argv[:]
ptvsdArgs.pop(1)

# Load the debugger package
try:
    folder_name = (
        f"python-{get_folder_tag()}-37"
        if platform.python_version()[:3] == "3.7"
        else "python"
    )
    ptvs_lib_path = os.path.join(os.path.dirname(__file__), "lib", folder_name)
    if useCustomPtvsd:
        sys.path.append(ptvs_lib_path)
    else:
        sys.path.insert(0, ptvs_lib_path)
    try:
        import ptvsd
        from ptvsd.__main__ import main
        ptvsd_loaded = True
    except ImportError:
        ptvsd_loaded = False
        raise
except:
    traceback.print_exc()
    print('''
Internal error detected. Please copy the above traceback and report at
https://github.com/Microsoft/vscode-python/issues/new

Press Enter to close. . .''')
    try:
        raw_input()
    except NameError:
        input()
    sys.exit(1)
finally:
    if ptvs_lib_path:
        sys.path.remove(ptvs_lib_path)

main(ptvsdArgs)
