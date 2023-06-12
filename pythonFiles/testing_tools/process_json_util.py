# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
import io
import json
from typing import List

CONTENT_LENGTH: str = "Content-Length:"


def process_rpc_json(data: str) -> List[str]:
    """Process the JSON data which comes from the server."""
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
