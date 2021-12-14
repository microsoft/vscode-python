# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import json
import sys

obj = {}
obj["versionInfo"] = tuple(sys.version_info)
obj["sysPrefix"] = sys.prefix
obj["sysVersion"] = sys.version
obj["is64Bit"] = sys.maxsize > 2 ** 32

# Printing out markers for our JSON to make it more resilient to pull the output.
print(">>>JSON")
print(json.dumps(obj))
print("<<<JSON")
