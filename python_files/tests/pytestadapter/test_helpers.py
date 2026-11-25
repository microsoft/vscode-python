# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os
import subprocess
import sys
import threading

import pytest

from . import helpers


def test_run_test_code_times_out(tmp_path, monkeypatch):
    monkeypatch.setattr(helpers, "TEST_SUBPROCESS_TIMEOUT_SECONDS", 0.01)
    completed = threading.Event()

    with pytest.raises(subprocess.TimeoutExpired):
        helpers._run_test_code(  # noqa: SLF001
            [sys.executable, "-c", "import time; time.sleep(1)"],
            os.environ.copy(),
            str(tmp_path),
            completed,
        )

    assert completed.is_set()


def test_wait_for_pipe_result_surfaces_subprocess_failure():
    listener_thread = threading.Thread(target=lambda: None)
    listener_thread.start()
    process_result = subprocess.CompletedProcess(["pytest"], returncode=2)

    with pytest.raises(subprocess.CalledProcessError):
        helpers._wait_for_pipe_result(  # noqa: SLF001
            listener_thread, process_result, []
        )


def test_wait_for_pipe_result_times_out(monkeypatch):
    monkeypatch.setattr(helpers, "PIPE_RESULT_TIMEOUT_SECONDS", 0.01)
    release_listener = threading.Event()
    listener_thread = threading.Thread(target=release_listener.wait, daemon=True)
    listener_thread.start()
    process_result = subprocess.CompletedProcess(["pytest"], returncode=0)

    try:
        with pytest.raises(TimeoutError, match="Timed out waiting"):
            helpers._wait_for_pipe_result(  # noqa: SLF001
                listener_thread, process_result, []
            )
    finally:
        release_listener.set()
        listener_thread.join()
