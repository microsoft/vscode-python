# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import shutil
import sys
from enum import Enum
from subprocess import run, PIPE


class Platform(Enum):
    OSX = 4
    Windows = 2
    Linux = 3


def get_platform() -> Platform:
    platforms = {
        "linux1": Platform.Linux,
        "linux2": Platform.Linux,
        "darwin": Platform.OSX,
        "win32": Platform.Windows,
    }
    if sys.platform not in platforms:
        return sys.platform

    return platforms[sys.platform]


def run_command(command, cwd=None, silent=False, progress_message=None, env=None):
    """Run the specified command in a subprocess shell."""

    if progress_message is not None:
        print(progress_message)
    executable = shutil.which(command[0])
    command[0] = executable
    stdout = PIPE if silent else None

    proc = run(command, cwd=cwd, stdout=stdout, shell=False, env=env)
    proc.check_returncode()
    # Note, we'll need some output to tell CI servers that process is still active.
    # if progress_message:
    #     progress = Spinner(progress_message)
    # while True:
    #     try:
    #         exit_code = proc.wait(1)
    #     except Exception:
    #         if progress:
    #             progress.next()
    #         continue

    #     print(exit_code)
    #     if exit_code == 0:
    #         return
    #     if exit_code is not None:
    #         raise SystemError(
    #             "Command exited with a non-zero exit code," + command
    #         )  # noqa
