# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See LICENSE in the project root
# for license information.

import argparse
import os.path
import sys

import pydevd

from ptvsd.pydevd_hooks import install


__author__ = "Microsoft Corporation <ptvshelp@microsoft.com>"
__version__ = "4.0.0a5"


def run_module(address, modname, *extra, **kwargs):
    """Run pydevd for the given module."""
    run = kwargs.pop('_run', _run)
    prog = kwargs.pop('_prog', sys.argv[0])
    filename = modname + ':'
    argv = _run_argv(address, filename, extra, _prog=prog)
    argv.insert(argv.index('--file'), '--module')
    run(argv, **kwargs)


def run_file(address, filename, *extra, **kwargs):
    """Run pydevd for the given Python file."""
    run = kwargs.pop('_run', _run)
    prog = kwargs.pop('_prog', sys.argv[0])
    argv = _run_argv(address, filename, extra, _prog=prog)
    run(argv, **kwargs)


def _run_argv(address, filename, extra, _prog=sys.argv[0]):
    """Convert the given values to an argv that pydevd.main() supports."""
    if '--' in extra:
        pydevd = list(extra[:extra.index('--')])
        extra = list(extra[len(pydevd) + 1:])
    else:
        pydevd = []
        extra = list(extra)

    host, port = address
    #if host is None:
    #    host = '127.0.0.1'
    argv = [
        _prog,
        '--port', str(port),
    ]
    if host is not None:
        argv.extend([
            '--client', host,
        ])
    return argv + pydevd + [
        '--file', filename,
    ] + extra


def _run(argv, _pydevd=pydevd, _install=install, **kwargs):
    """Start pydevd with the given commandline args."""
    #print(' '.join(argv))

    # Pydevd assumes that the "__main__" module is the "pydevd" module
    # and does some tricky stuff under that assumption.  For example,
    # when the debugger starts up it calls save_main_module()
    # (in pydevd_bundle/pydevd_utils.py).  That function explicitly sets
    # sys.modules["pydevd"] to sys.modules["__main__"] and then sets
    # the __main__ module to a new one.  This makes some sense since
    # it gives the debugged script a fresh __main__ module.
    #
    # This complicates things for us since we are running a different
    # file (i.e. this one) as the __main__ module.  Consequently,
    # sys.modules["pydevd"] gets set to ptvsd/__main__.py.  Subsequent
    # imports of the "pydevd" module then return the wrong module.  We
    # work around this by avoiding lazy imports of the "pydevd" module.
    # We also replace the __main__ module with the "pydevd" module here.
    if sys.modules['__main__'].__file__ != _pydevd.__file__:
        sys.modules['__main___orig'] = sys.modules['__main__']
        sys.modules['__main__'] = _pydevd

    daemon = _install(_pydevd, **kwargs)
    sys.argv[:] = argv
    try:
        _pydevd.main()
    except SystemExit as ex:
        daemon.exitcode = int(ex.code)
        raise


##################################
# the script

"""
For the PyDevd CLI handling see:

  https://github.com/fabioz/PyDev.Debugger/blob/master/_pydevd_bundle/pydevd_command_line_handling.py
  https://github.com/fabioz/PyDev.Debugger/blob/master/pydevd.py#L1450  (main func)
"""  # noqa

PYDEVD_OPTS = {
    '--file',
    '--client',
    #'--port',
    '--vm_type',
}

PYDEVD_FLAGS = {
    '--DEBUG',
    '--DEBUG_RECORD_SOCKET_READS',
    '--cmd-line',
    '--module',
    '--multiproc',
    '--multiprocess',
    '--print-in-debugger-startup',
    '--save-signatures',
    '--save-threading',
    '--save-asyncio',
    '--server',
}

USAGE = """
  {0} [-h] [--host HOST] --port PORT -m MODULE [arg ...]
  {0} [-h] [--host HOST] --port PORT FILENAME [arg ...]
"""


def parse_args(argv=None):
    """Return the parsed args to use in main()."""
    if argv is None:
        argv = sys.argv
        prog = argv[0]
        if prog == __file__:
            prog = '{} -m ptvsd'.format(os.path.basename(sys.executable))
    else:
        prog = argv[0]
    argv = argv[1:]

    supported, pydevd, script = _group_args(argv)
    args = _parse_args(prog, supported)
    extra = pydevd
    if script:
        extra += ['--'] + script
    return args, extra


def _group_args(argv):
    supported = []
    pydevd = []
    script = []

    try:
        pos = argv.index('--')
    except ValueError:
        script = []
    else:
        script = argv[pos + 1:]
        argv = argv[:pos]

    for arg in argv:
        if arg == '-h' or arg == '--help':
            return argv, [], script

    gottarget = False
    skip = 0
    for i in range(len(argv)):
        if skip:
            skip -= 1
            continue

        arg = argv[i]
        try:
            nextarg = argv[i + 1]
        except IndexError:
            nextarg = None

        # TODO: Deprecate the PyDevd arg support.
        # PyDevd support
        if gottarget:
            script = argv[i:] + script
            break
        if arg == '--client':
            arg = '--host'
        elif arg == '--file':
            if nextarg is None:  # The filename is missing...
                pydevd.append(arg)
                continue  # This will get handled later.
            if nextarg.endswith(':') and '--module' in pydevd:
                pydevd.remove('--module')
                arg = '-m'
                argv[i + 1] = nextarg = nextarg[:-1]
            else:
                arg = nextarg
                skip += 1
        if arg in PYDEVD_OPTS:
            pydevd.append(arg)
            if nextarg is not None:
                pydevd.append(nextarg)
            skip += 1
        elif arg in PYDEVD_FLAGS:
            pydevd.append(arg)

        # ptvsd support
        elif arg in ('--host', '--port', '-m'):
            if arg == '-m':
                gottarget = True
            supported.append(arg)
            if nextarg is not None:
                supported.append(nextarg)
            skip += 1
        elif not arg.startswith('-'):
            supported.append(arg)
            gottarget = True

        # unsupported arg
        else:
            supported.append(arg)
            break

    return supported, pydevd, script


def _parse_args(prog, argv):
    parser = argparse.ArgumentParser(
        prog=prog,
        usage=USAGE.format(prog),
    )
    parser.add_argument('--host')
    parser.add_argument('--port', type=int, required=True)

    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument('-m', dest='module')
    target.add_argument('filename', nargs='?')

    args = parser.parse_args(argv)
    ns = vars(args)

    args.address = (ns.pop('host'), ns.pop('port'))

    module = ns.pop('module')
    filename = ns.pop('filename')
    if module is None:
        args.name = filename
        args.kind = 'script'
    else:
        args.name = module
        args.kind = 'module'
    #if argv[-1] != args.name or (module and argv[-1] != '-m'):
    #    parser.error('script/module must be last arg')

    return args


def main(address, name, kind, *extra, **kwargs):
    if kind == 'module':
        run_module(address, name, *extra, **kwargs)
    else:
        run_file(address, name, *extra, **kwargs)


if __name__ == '__main__':
    args, extra = parse_args()
    main(args.address, args.name, args.kind, *extra)
