import getopt
import inspect
import os
import requests
import sys
import traceback
import unittest

sys.path.insert(0, os.getcwd())

# Get arguments
argv = sys.argv[1:]
index = argv.index("--")

script_args, _ = getopt.getopt(argv[:index], "", ["port="])
unittest_args, _ = getopt.getopt(
    argv[index + 1 :],
    "vs:p:t:",
    ["start-directory=", "pattern=", "top-level-directory="],
)


# Parse command-line arguments that should be processed by the script,
# for example the port number that it needs to connect to.
def parse_script_args(args):
    # The port is passed to the discovery.py script when it is executed,
    # defaults to 45454 if it can't be parsed.
    port = 45454
    for opt in args:
        if opt[0] == "--port":
            port = opt[1]
    return port


# Parse command-line arguments that should be forwarded to unittest.
# Unittest arguments are: -v, -s, -p, -t, in that order.
def parse_unittest_args(args):
    pattern = "test*.py"
    top_level_dir = None

    for opt in args:
        if opt[0] == "-s":
            start_dir = opt[1]
        elif opt[0] == "-p":
            pattern = opt[1]
        elif opt[0] == "-t":
            top_level_dir = opt[1]

    return start_dir, pattern, top_level_dir


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
start_dir, pattern, top_level_dir = parse_unittest_args(unittest_args)
payload = {"cwd": os.path.abspath(start_dir)}
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

payload["tests"] = tests

if len(loader_errors):
    payload["errors"] = loader_errors

# Connect to the TypeScript side and send payload.
port = parse_script_args(script_args)
requests.post(f"http://localhost:{port}", json=payload)


# Message formatting:
#
# Successful discovery:
# {
#     "cwd": <test discovery directory>
#     "status": "success",
#     "tests":[
#         {
#           "id": <test id>,
#           "lineno": <source line>,
#         },
#         ...
#     ]
# }
#
# Error:
# {
#     "cwd": <test discovery directory>
#     "errors": [list of errors]
#     "status": "error",
# }
#
