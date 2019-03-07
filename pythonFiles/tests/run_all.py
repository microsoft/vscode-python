# Replace the "." entry.
import os.path
import sys
sys.path[0] = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)))

from tests.__main__ import main


if __name__ == '__main__':
    ec = main()
    sys.exit(ec)
