# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os
from unittest.mock import patch


# Testing pytest with a mocked os.getcwd. The test passes.
def test_getcwd_mocked():  # test_marker--test_getcwd_mocked
    with patch.object(os, "getcwd", return_value="/mocked/path"):
        result = os.getcwd()
        assert result == "/mocked/path"
