import getopt
import inspect
import json
import os
import sys
import traceback
import unittest

from jsonrpc import JSONRPCResponseManager, dispatcher

sys.path.insert(0, os.getcwd())

# Get arguments: -v, -s, -p, -t in that order
argv = sys.argv[1:]
opts, args = getopt.getopt(argv, "vs:p:t:")

pattern = "test*.py"
top_level_dir = None

for opt in opts:
    if opt[0] == "-s":
        start_dir = opt[1]
    elif opt[0] == "-p":
        pattern = opt[1]
    elif opt[0] == "-t":
        top_level_dir = opt[1]

# Helper functions
def get_test_cases(suite):
    for test in suite:
        if isinstance(test, unittest.TestCase):
            yield test
        else:
            for test_case in get_test_cases(test):
                yield test_case


def get_source_line(obj):
    try:
        sourcelines, lineno = inspect.getsourcelines(obj)
    except:
        try:
            sourcelines, lineno = inspect.getsourcelines(obj.orig_method)
        except:
            return "*"

    # Return the line number of the first line of the test case definition.
    for i, v in enumerate(sourcelines):
        if v.strip().startswith(("def", "async def")):
            return str(lineno + i)
    return "*"


# Test discovery
payload = {"command": " ".join(sys.argv[:]), "cwd": os.getcwd()}
tests = []

try:
    loader = unittest.TestLoader()
    suite = loader.discover(start_dir, pattern, top_level_dir)
    loader_errors = []

    for test in get_test_cases(suite):
        test_id = test.id()
        test_method = getattr(test, test._testMethodName)
        lineno = get_source_line(test_method)

        # Build payload
        if test_id.startswith("unittest.loader._FailedTest"):
            loader_errors.append(test._exception.__str__())
        else:
            tests.append({"id": test_id, "lineno": lineno})
except:
    payload["status"] = "error"
    payload["errors"] = [traceback.format_exc()]

if len(tests):
    payload["tests"] = tests

if len(loader_errors):
    payload["errors"] = loader_errors

print(json.dumps(payload))
# Send payload with results
# r = requests.post("http://localhost:8080/", json=payload)
# print(r.text)


# Message formatting:
#
# Successful discovery:
# {
#     "command": <script execution command>
#     "cwd": <current working directory>
#     "status": "success",
#     "tests":[
#         {
#           "id": <test id>,
#           "lineno": <source line>,
#           "params": <parameters> # In case of subtests
#         },
#         ...
#     ]
# }
#
# Error:
# {
#     "command": <script execution command string>
#     "cwd": <current working directory>
#     "errors": [list of errors]
#     "status": "error",
# }
#
