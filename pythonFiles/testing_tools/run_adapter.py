# Replace the "." entry.
from testing_tools.adapter.__main__ import parse_args, main
import os.path
import sys
sys.path[0] = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)))


if __name__ == '__main__':
    tool, cmd, subargs, toolargs = parse_args()
    main(tool, cmd, subargs, toolargs)
