# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import logging
import os
import os.path
import shutil
import subprocess
import sys
import time
import traceback
from functools import wraps

import progress.bar
import pyperclip
import requests


def retry(exceptions, tries=100, delay=0.1, backoff=1):
    """Retry calling the decorated function using an exponential backoff.
    Original source from https://www.calazan.com/retry-decorator-for-python-3/
    Args:
        exceptions: The exception to check. may be a tuple of
            exceptions to check.
        tries: Number of times to try (not retry) before giving up.
        delay: Initial delay between retries in seconds.
        backoff: Backoff multiplier (e.g. value of 2 will double the delay
            each retry).

    """

    def deco_retry(f):
        @wraps(f)
        def f_retry(*args, **kwargs):
            mtries, mdelay = tries, delay
            timeout = tries * delay
            start = time.time()
            # The code could take a few milli seconds to run,
            # Hence the timeout could be too high.
            # Instead lets wait for loop to run at least 20 times,
            # Before checking if we have exceeded timeout.
            # Else for instance if we have a timeout of 120 seconds (tries = 1200),
            # This could be too high, as code can take > 0.5 seconds to execute or longer.
            while mtries > 1:
                try:
                    return f(*args, **kwargs)
                except exceptions:
                    # except exceptions as e:
                    #     msg = "{}, Retrying in {} seconds...".format(e, mdelay)
                    #     logging.info(msg)
                    time.sleep(mdelay)
                    mtries -= 1
                    mdelay *= backoff

                    if tries - mtries > 20 and (time.time() - start) > timeout:
                        msg = f"Timeout: After {timeout} seconds."
                        raise TimeoutError(msg)
            return f(*args, **kwargs)

        return f_retry  # true decorator

    return deco_retry


def log_exceptions():
    """Decorator to just log exceptions and re-raise them.
    For some reason behave doesn't print the entire stack trace when handling exceptions.

    """

    def deco_log_exceptions(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            try:
                return f(*args, **kwargs)
            except Exception:
                logging.info(traceback.format_exc())
                raise

        return wrapper

    return deco_log_exceptions


def run_command(command, *, cwd=None, silent=False, progress_message=None, env=None):
    """Run the specified command in a subprocess shell with the following options:
    - Pipe output from subprocess into current console.
    - Display a progress message.

    """

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
    # Ignore errors on windows.
    for root, dirs, files in os.walk(dir):
        for f in files:
            try:
                os.unlink(os.path.join(root, f))
            except Exception:
                pass
        for d in dirs:
            try:
                shutil.rmtree(os.path.join(root, d))
            except Exception:
                pass


@retry(Exception, tries=30)
def wait_for_python_env(cwd, path):
    python_exec = _get_python_executable(path)
    subprocess.run(
        [python_exec, "--version"], check=True, stdout=subprocess.PIPE, cwd=cwd
    ).stdout


@retry(Exception, tries=30)
def wait_for_pipenv(cwd):
    subprocess.run(
        ["pipenv", "--py"],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        cwd=cwd,
    )


@retry(Exception, tries=30, delay=5)
def wait_for_conda_env(conda_path, env_name):
    proc = subprocess.run(
        [conda_path, "env", "list"],
        check=False,
        env=os.environ.copy(),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    output = proc.stdout.decode("utf-8") + proc.stderr.decode("utf-8")
    assert env_name in output, f"{env_name} not in {output}"


def copy_to_clipboard(text):
    """Copies text to the clipboard."""
    pyperclip.copy(text)


def _get_python_executable(path):
    if sys.platform.startswith("win"):
        return os.path.join(path, "Scripts", "python.exe")
    else:
        return os.path.join(path, "bin", "python")
