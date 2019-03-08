# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os
import os.path
import requests
import shutil
import time
from progress.bar import Bar
from subprocess import run, PIPE, Popen


def ensure_directory(dir: str):
    if not os.path.exists(dir):
        os.makedirs(dir)


def run_command(command, cwd=None, silent=False, progress_message=None, env=None):
    """Run the specified command in a subprocess shell."""

    if progress_message is not None:
        print(progress_message)
    executable = shutil.which(command[0])
    command[0] = executable
    print(command)
    stdout = PIPE if silent else None

    run(command, cwd=cwd, stdout=stdout, shell=False, check=True, env=env)
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



def unzip_file(zip_file: str, destination: str):
    """Unzip a file"""

    # For now now using zipfile module,
    # as the unzippig didn't work for executables.
    run_command(
        ["unzip", zip_file, "-d", destination],
        silent=True,
        progress_message="Extracting zip file",
    )


def download_file(url: str, download_file: str, progress_message="Downloading"):  # noqa
    """Downloads a file and optionally displays a progress indicator"""

    download_file = os.path.abspath(download_file)
    try:
        os.remove(download_file)
    except FileNotFoundError:
        pass
    progress = Bar(progress_message, max=100)
    response = requests.get(url, stream=True)
    total = response.headers.get("content-length")

    try:
        with open(download_file, "wb") as fs:
            if total is None:
                fs.write(response.content)
            else:
                downloaded = 0
                total = int(total)
                chunk_size = 1024 * 1024
                percent = 0
                for data in response.iter_content(chunk_size=chunk_size):
                    downloaded += len(data)
                    fs.write(data)
                    change_in_percent = int(downloaded * 100 / total) - percent
                    percent = int(downloaded * 100 / total)
                    for i in range(change_in_percent):
                        progress.next()
    except Exception:
        os.remove(download_file)
        raise
    finally:
        progress.finish()
