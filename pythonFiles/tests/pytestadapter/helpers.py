# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import contextlib
import io
import json
import os
import pathlib
import random
import subprocess
import sys
import uuid
from typing import Dict, List, Union

TEST_DATA_PATH = pathlib.Path(__file__).parent / ".data"
from typing_extensions import TypedDict


@contextlib.contextmanager
def test_output_file(root: pathlib.Path, ext: str = ".txt"):
    """Creates a temporary python file with a random name."""
    basename = (
        "".join(random.choice("abcdefghijklmnopqrstuvwxyz") for _ in range(9)) + ext
    )
    fullpath = root / basename
    try:
        fullpath.write_text("", encoding="utf-8")
        yield fullpath
    finally:
        os.unlink(str(fullpath))


CONTENT_LENGTH: str = "Content-Length:"


def process_rpc_json(data: str) -> Dict[str, str]:
    """Process the JSON data which comes from the server which runs the pytest discovery."""
    str_stream: io.StringIO = io.StringIO(data)

    length: int = 0

    while True:
        line: str = str_stream.readline()
        if CONTENT_LENGTH.lower() in line.lower():
            length = int(line[len(CONTENT_LENGTH) :])
            break

        if not line or line.isspace():
            raise ValueError("Header does not contain Content-Length")

    while True:
        line: str = str_stream.readline()
        if not line or line.isspace():
            break

    raw_json: str = str_stream.read(length)
    return json.loads(raw_json)


def runner(args: List[str]) -> Union[Dict[str, str], None]:
    """Run the pytest discovery and return the JSON data from the server."""
    process_args: List[str] = [
        sys.executable,
        "pytest",
        "-p",
        "vscode_pytest",
    ] + args

    with test_output_file(TEST_DATA_PATH) as output_path:
        env = {
            "TEST_UUID": str(uuid.uuid4()),
            "TEST_PORT": str(12345),  # port is not used for tests
            "PYTHONPATH": os.fspath(pathlib.Path(__file__).parent.parent.parent),
            "TEST_OUTPUT_FILE": os.fspath(output_path),
        }

        result = subprocess.run(
            process_args,
            env=env,
            cwd=os.fspath(TEST_DATA_PATH),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            shell=True,
        )

        if result.returncode != 0:
            print("Subprocess Run failed with:")
            print(result.stdout.decode(encoding="utf-8"))
            print(result.stderr.decode(encoding="utf-8"))

        return process_rpc_json(output_path.read_text(encoding="utf-8"))


def find_test_line_number(test_name: str, test_file_path) -> str:
    """Function which finds the correct line number for a test by looking for the "test_marker--[test_name]" string.

    The test_name is split on the "[" character to remove the parameterization information.

    Args:
    test_name: The name of the test to find the line number for, will be unique per file.
    test_file_path: The path to the test file where the test is located.
    """
    test_file_unique_id: str = "test_marker--" + test_name.split("[")[0]
    with open(test_file_path) as f:
        for i, line in enumerate(f):
            if test_file_unique_id in line:
                return str(i + 1)
    error_str: str = f"Test {test_name!r} not found on any line in {test_file_path}"
    raise ValueError(error_str)
