# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os
import sys
from pathlib import Path


# Add the lib path to our sys path so jedi_language_server can find its references
EXTENSION_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, os.fspath(EXTENSION_ROOT / "pythonFiles" / "lib" / "jedilsp"))


from jedi_language_server.cli import cli

sys.exit(cli())
