# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


def parse_argv():
    """Parses arguments for use with the test launcher.
    Arguments are:
    1. Working directory.
    2. Test runner, `pytest` or `nose`
    3. Rest of the arguments are passed into the test runner.
    """

    return (sys.argv[1], sys.argv[2], sys.argv[3:])


def run(cwd, testRunner, args):
    """Runs the test
    cwd -- the current directory to be set
    testRuner -- test runner to be used `pytest` or `nose`
    args -- arguments passed into the test runner
    """

    import os
    import sys
    
    sys.path[0] = os.getcwd()
    os.chdir(cwd)

    try:
        if testRunner == 'pytest':
            import pytest
            pytest.main(args)
        else:
            import nose
            nose.run(argv=args)
        sys.exit()
    finally:
        pass


if __name__ == '__main__':
    cwd, testRunner, args = parse_argv()
    run(cwd, testRunner, args)
