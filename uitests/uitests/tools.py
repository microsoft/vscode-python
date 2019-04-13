# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import logging
import os
import os.path
import shutil
import subprocess
import sys
import time
from functools import wraps

import progress.bar
import requests


def retry(exceptions, tries=100, delay=0.1, backoff=1, logger=None):
    """
    Retry calling the decorated function using an exponential backoff.
    Original source from https://www.calazan.com/retry-decorator-for-python-3/
    Args:
        exceptions: The exception to check. may be a tuple of
            exceptions to check.
        tries: Number of times to try (not retry) before giving up.
        delay: Initial delay between retries in seconds.
        backoff: Backoff multiplier (e.g. value of 2 will double the delay
            each retry).
        logger: Logger to use. If None, print.
    """

    def deco_retry(f):
        @wraps(f)
        def f_retry(*args, **kwargs):
            mtries, mdelay = tries, delay
            while mtries > 1:
                try:
                    return f(*args, **kwargs)
                except exceptions as e:
                    msg = "{}, Retrying in {} seconds...".format(e, mdelay)
                    if logger:
                        logger.warning(msg)
                    else:
                        print(msg)
                    time.sleep(mdelay)
                    mtries -= 1
                    mdelay *= backoff
            return f(*args, **kwargs)

        return f_retry  # true decorator

    return deco_retry


def run_command(command, *, cwd=None, silent=False, progress_message=None, env=None):
    """Run the specified command in a subprocess shell with the following options:
    - Pipe output from subprocess into current console.
    - Display a progress message."""

    if progress_message is not None:
        logging.info(progress_message)
    is_git = command[0] == "git"
    shell = is_git
    command[0] = shutil.which(command[0])
    out = subprocess.PIPE if silent else None
    # Else Python throws crazy errors (socket (10106) The requested service provider could not be loaded or initialized.)
    # The solution is to pass the complete list of variables.
    if sys.platform.startswith("win"):
        new_env = {} if env is None else env
        env = os.environ.copy()
        env.update(new_env)
    if not is_git:
        proc = subprocess.run(
            command, cwd=cwd, shell=shell, env=env, stdout=out, stderr=out
        )
        proc.check_returncode()
        return
    p = subprocess.Popen(command, cwd=cwd, stdout=out, stderr=out, shell=False)
    _, err = p.communicate()

    if p.returncode != 0:
        raise SystemError(
            f"Exit code is not 0, {p.returncode} for command {command}, with an error: {err}"
        )
    # return (p.returncode, out, err)

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


def unzip_file(zip_file, destination, progress_message="Unzip"):
    """Unzip a file."""

    # For now now using zipfile module,
    # as the unzippig didn't work for executables.
    os.makedirs(destination, exist_ok=True)
    dir = os.path.dirname(os.path.realpath(__file__))
    js_file = os.path.join(dir, "js", "unzip.js")
    run_command(
        ["node", js_file, zip_file, destination], progress_message=progress_message
    )


def download_file(url, download_file, progress_message="Downloading"):  # noqa
    """Download a file and optionally displays a progress indicator."""

    try:
        os.remove(download_file)
    except FileNotFoundError:
        pass
    progress_bar = progress.bar.Bar(progress_message, max=100)
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
                    change_in_percent = (downloaded * 100 // total) - percent
                    percent = downloaded * 100 // total
                    for i in range(change_in_percent):
                        progress_bar.next()
    except Exception:
        os.remove(download_file)
        raise
    finally:
        progress_bar.finish()


def empty_directory(dir):
    for root, dirs, files in os.walk(dir):
        for f in files:
            os.unlink(os.path.join(root, f))
        for d in dirs:
            shutil.rmtree(os.path.join(root, d))


def wait_for_python_env(cwd, path, timeout=30):
    start_time = time.time()
    python_exec = _get_python_executable(path)
    while time.time() - start_time < timeout:
        try:
            subprocess.run(
                [python_exec, "--version"], check=True, stdout=subprocess.PIPE, cwd=cwd
            ).stdout
            return
        except Exception as ex:
            print(ex)
            pass
    raise SystemError(f"Virtual Env not detected after {timeout}s")


def wait_for_pipenv(cwd, timeout=30):
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            subprocess.run(
                ["pipenv", "--py"],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                cwd=cwd,
            )
            return
        except Exception as ex:
            print(ex)
            pass
    raise SystemError(f"PipEnv not detected after {timeout}s")


def _get_python_executable(path):
    if sys.platform.startswith("win"):
        return os.path.join(path, "Scripts", "python.exe")
    else:
        return os.path.join(path, "bin", "python")
