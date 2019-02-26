from __future__ import absolute_import

import argparse
import sys

from . import pytest, report
from .errors import UnsupportedToolError, UnsupportedCommandError


TOOLS = {
        'pytest': pytest,
        }


def parse_args(
        argv=sys.argv[1:],
        prog=sys.argv[0],
        ):
    """
    Return the subcommand & tool to run, along with its args.

    This defines the standard CLI for the different testing frameworks.
    """
    parser = argparse.ArgumentParser(
            description='Run Python testing operations.',
            prog=prog,
            )
    cmdsubs = parser.add_subparsers(dest='cmd')

    discover = cmdsubs.add_parser('discover')
    discover_subs = discover.add_subparsers(dest='tool')
    pytest.add_cli_subparser('discover', 'pytest', discover_subs)

    # Add "run" and "debug" subcommands when ready.

    # Parse the args!
    args, toolargs = parser.parse_known_args(argv)
    #args = parser.parse_args(argv)
    ns = vars(args)

    cmd = ns.pop('cmd')
    if not cmd:
        parser.error('missing subcommand')
    tool = ns.pop('tool')

    return tool, cmd, ns, toolargs


def main(tool, cmd, subargs, toolargs, tools=TOOLS, report=report):
    try:
        tool = tools[tool]
    except KeyError:
        raise UnsupportedToolError(tool)

    if cmd == 'discover':
        discovered = tool.discover(toolargs, **subargs)
        report.discovered(discovered)
    else:
        raise UnsupportedCommandError(cmd)


if __name__ == '__main__':
    tool, cmd, subargs, toolargs = parse_args()
    main(tool, cmd, subargs)
