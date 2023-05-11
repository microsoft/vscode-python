# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import argparse
import json
import os
import pathlib
import sys
from typing import Optional, Sequence

LIB_ROOT = pathlib.Path(__file__).parent / "lib" / "python"
sys.path.insert(0, os.fspath(LIB_ROOT))

from importlib_metadata import metadata
from packaging.requirements import Requirement


def parse_args(argv: Optional[Sequence[str]] = None):
    if argv is None:
        argv = sys.argv[1:]
    parser = argparse.ArgumentParser(
        description="Check for installed packages against requirements"
    )
    parser.add_argument(
        "REQUIREMENTS", type=str, help="Path to requirements.[txt, in]", nargs="+"
    )

    return parser.parse_args(argv)


def parse_requirements(line: str) -> Optional[Requirement]:
    try:
        req = Requirement(line.strip("\\"))
        if req.marker is None:
            return req
        elif req.marker.evaluate():
            return req
    except:
        return None


def main():
    args = parse_args()

    diagnostics = []
    for req_file in args.REQUIREMENTS:
        req_file = pathlib.Path(req_file)
        if req_file.exists():
            lines = req_file.read_text(encoding="utf-8").splitlines()
            for n, line in enumerate(lines):
                if line.startswith(("#", "-", " ")) or line == "":
                    continue

                req = parse_requirements(line)
                if req:
                    try:
                        # Check if package is installed
                        metadata(req.name)
                    except:
                        diagnostics.append(
                            {
                                "line": n,
                                "package": req.name,
                                "code": "not-installed",
                                "severity": 3,
                            }
                        )
    print(json.dumps(diagnostics, ensure_ascii=False))


if __name__ == "__main__":
    main()
