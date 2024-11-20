# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.

import pytest
import os


@pytest.mark.forked
def test_forked_process_p():
    pid = os.getpid()
    print(f"Running in process with PID: {pid}")
    assert True
@pytest.mark.forked
def test_forked_process_f():
    pid = os.getpid()
    print(f"Running in process with PID: {pid}")
    assert False
