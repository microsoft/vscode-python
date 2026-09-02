# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
import time


def test_result_before_cancellation():
    assert True


def test_waits_for_cancellation():
    time.sleep(120)
