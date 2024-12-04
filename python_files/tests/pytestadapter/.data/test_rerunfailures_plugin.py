# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import pytest
import os

@pytest.mark.flaky(reruns=2)
def test_flaky():  # test_marker--test_flaky
    # count is not set for first run, but set to 2 for the second run
    count = os.environ.get("COUNT")
    os.environ["COUNT"] = "2"
    # this will fail on the first run, but pass on the second (1 passed, 1 rerun)
    assert count == "2"

def test_flaky_no_marker():
    # this test is flaky and will be run via the command line argument
    # count is not set for first run, but set to 2 for the second run
    count = os.environ.get("COUNT")
    os.environ["COUNT"] = "2"
    # this will fail on the first run, but pass on the second (1 passed, 1 rerun)
    assert count == "2"
