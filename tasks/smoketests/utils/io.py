# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import os
import os.path
import requests
import shutil
from progress.bar import Bar
from .tools import run_command


def ensure_directory(dir: str):
    if not os.path.exists(dir):
        os.makedirs(dir)


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


def empty_directory(dir: str):
    for root, dirs, files in os.walk(dir):
        for f in files:
            os.unlink(os.path.join(root, f))
        for d in dirs:
            shutil.rmtree(os.path.join(root, d))


def copy_recursive(source_dir: str, target_dir: str):
    for src_dir, dirs, files in os.walk(source_dir):
        dst_dir = src_dir.replace(source_dir, target_dir)
        if not os.path.exists(dst_dir):
            os.mkdir(dst_dir)
        for file_ in files:
            src_file = os.path.join(src_dir, file_)
            dst_file = os.path.join(dst_dir, file_)
            if not os.path.exists(dst_file):
                shutil.copy(src_file, dst_dir)
