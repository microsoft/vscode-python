# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
import sys
try:
    import json

    obj = {}
    obj["versionInfo"] = tuple(sys.version_info)
    obj["sysPrefix"] = sys.prefix
    obj["sysVersion"] = sys.version
    obj["is64Bit"] = sys.maxsize > 2 ** 32

    print(json.dumps(obj))
finally:
    sys.exit(42)
