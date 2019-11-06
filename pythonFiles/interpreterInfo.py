# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import json
import sys

obj = {}
obj["versionInfo"] = sys.version_info[:4]
obj["sysPrefix"] = sys.prefix
obj["version"] = sys.version
obj["is64Bit"] = sys.maxsize > 2**32

print(json.dumps(obj))
# import io
# import sys

# from contextlib import contextmanager

# @contextmanager
# def stdout_redirector(stdout_stream, stderr_stream):
#     old_stdout = sys.stdout
#     sys.stdout = stdout_stream
#     old_stderr = sys.stderr
#     sys.stderr = stderr_stream
#     try:
#         yield
#     finally:
#         sys.stdout = old_stdout
#         sys.stderr = old_stderr

# # import jupyter_core
# # import jupyter_core.command
# # sys.argv = ['', 'notebook', '--no-browser']
# # fout = io.StringIO()
# # ferr = io.StringIO()

# # with stdout_redirector(fout, ferr):
# #     jupyter_core.command.main()


# import time
# for i in range(10):
#     time.sleep(1)
#     print(i)
