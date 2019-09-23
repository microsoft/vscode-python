# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import sys
import os.path

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PYTHONFILES = os.path.join(ROOT, "pythonFiles", "lib", "python")
REQUIREMENTS = os.path.join(ROOT, "requirements.txt")

sys.path.insert(0, PYTHONFILES)

from packaging.requirements import Requirement
from packaging.tags import sys_tags

sys.path.remove(PYTHONFILES)


def ptvsd_folder_name():
    """Return the folder name for the bundled PTVSD wheel compatible with the new debug adapter."""

    with open(REQUIREMENTS, "r", encoding="utf-8") as reqsfile:
        for line in reqsfile:
            pkgreq = Requirement(line)
            if pkgreq.name == "ptvsd":
                specs = pkgreq.specifier
                try:
                    spec, = specs
                    version = spec.version
                except:
                    # Fallpack to use base PTVSD path.
                    print(PYTHONFILES, end="")
                    return
                break

    try:
        for tag in sys_tags():
            folder_name = f"ptvsd-{version}-{tag.interpreter}-{tag.abi}-{tag.platform}"
            folder_path = os.path.join(PYTHONFILES, folder_name)
            if os.path.exists(folder_path):
                print(folder_path, end="")
                return
    except:
        # Fallback to use base PTVSD path no matter the exception.
        print(PYTHONFILES, end="")
        return

    # Default fallback to use base PTVSD path.
    print(PYTHONFILES, end="")


if __name__ == "__main__":
    ptvsd_folder_name()
