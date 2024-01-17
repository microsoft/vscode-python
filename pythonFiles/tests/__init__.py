# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
import os
from pathlib import Path

TEST_ROOT = os.fspath(Path(__file__).resolve().parent)
SRC_ROOT = os.fspath(Path(TEST_ROOT).parent)
PROJECT_ROOT = os.fspath(Path(SRC_ROOT).parent)
TESTING_TOOLS_ROOT = os.fspath(Path(SRC_ROOT) / "testing_tools")
DEBUG_ADAPTER_ROOT = os.fspath(Path(SRC_ROOT) / "debug_adapter")

PYTHONFILES = os.fspath(Path(SRC_ROOT) / "lib" / "python")
