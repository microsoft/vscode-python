# content of conftest.py
import sys

# Ignore the contents of this folder for Python2 tests.
if sys.version_info[0] < 3:
    collect_ignore.append(".")
