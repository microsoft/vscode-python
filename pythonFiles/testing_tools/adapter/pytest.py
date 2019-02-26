from .errors import UnsupportedCommandError


def add_cli_subparser(cmd, name, parent):
    parser = parent.add_parser(name)
    if cmd == 'discover':
        # For now we don't have any tool-specific CLI options to add.
        pass
    else:
        raise UnsupportedCommandError(cmd)
    return parser


def discover(pytestargs=None):
    """Return the results of test discovery."""
    raise NotImplementedError
