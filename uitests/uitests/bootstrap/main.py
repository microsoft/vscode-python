# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import os.path

import uitests.tools

_current_dir = os.path.dirname(os.path.realpath(__file__))
EXTENSION_DIR = os.path.abspath(os.path.join(_current_dir, "extension"))  # noqa
EXTENSION_FILE = os.path.join(EXTENSION_DIR, "smoketest-0.0.1.vsix")


def build_extension():
    """Build the bootstrap extension."""
    command = ["vsce", "package"]
    uitests.tools.run_command(
        command, cwd=EXTENSION_DIR, progress_message="Build Bootstrap Extension"  # noqa
    )


def get_extension_path():
    """Get the path to the VSIX of the bootstrap extension."""
    if not os.path.isfile(EXTENSION_FILE):
        build_extension()
    return EXTENSION_FILE
