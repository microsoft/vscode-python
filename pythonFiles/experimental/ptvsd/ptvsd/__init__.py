# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See LICENSE in the project root
# for license information.

__author__ = "Microsoft Corporation <ptvshelp@microsoft.com>"
__version__ = "4.0.0a5"

import sys
import os.path


PYDEVD_ROOT = os.path.join(os.path.dirname(__file__), 'pydevd')
del os

# Ensure that pydevd is our vendored copy.
for modname in sys.modules:
    if not modname.startswith('pydev') and not modname.startswith('_pydev'):
        continue
    mod = sys.modules[modname]
    if hasattr(mod, '__file__') and not mod.__file__.startswith(PYDEVD_ROOT):
        print(mod.__file__)
        #raise ImportError('incompatible copy of pydevd already imported')

# Add our vendored pydevd directory to path, so that it gets found first.
sys.path.insert(0, PYDEVD_ROOT)

# Now make sure all the top-level modules and packages in pydevd are loaded.
import _pydev_bundle  # noqa
import _pydev_imps  # noqa
import _pydev_runfiles  # noqa
import _pydevd_bundle  # noqa
import _pydevd_frame_eval  # noqa
import pydev_ipython  # noqa
import pydevd_concurrency_analyser  # noqa
import pydevd_plugins  # noqa
import pydevd  # noqa

# Remove sys.path entry added above - any pydevd modules that aren't
# loaded at this point, will be loaded using their parent package's
# __path__.
del sys.path[0]
del sys
