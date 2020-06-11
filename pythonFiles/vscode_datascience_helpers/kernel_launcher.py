"""Utilities for launching kernels"""
# No changes to original code
# Original source borrowed from https://github.com/jupyter/jupyter_client/blob/master/jupyter_client/launcher.py.

# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

import os
import sys
from subprocess import Popen, PIPE

from ipython_genutils.encoding import getdefaultencoding
from ipython_genutils.py3compat import cast_bytes_py2


def launch_kernel(
    cmd,
    stdin=None,
    stdout=None,
    stderr=None,
    env=None,
    independent=False,
    cwd=None,
    **kw
):
    """ Launches a localhost kernel, binding to the specified ports.

    Parameters
    ----------
    cmd : Popen list,
        A string of Python code that imports and executes a kernel entry point.

    stdin, stdout, stderr : optional (default None)
        Standards streams, as defined in subprocess.Popen.

    env: dict, optional
        Environment variables passed to the kernel

    independent : bool, optional (default False)
        If set, the kernel process is guaranteed to survive if this process
        dies. If not set, an effort is made to ensure that the kernel is killed
        when this process dies. Note that in this case it is still good practice
        to kill kernels manually before exiting.

    cwd : path, optional
        The working dir of the kernel process (default: cwd of this process).

    **kw: optional
        Additional arguments for Popen

    Returns
    -------

    Popen instance for the kernel subprocess
    """

    # Popen will fail (sometimes with a deadlock) if stdin, stdout, and stderr
    # are invalid. Unfortunately, there is in general no way to detect whether
    # they are valid.  The following two blocks redirect them to (temporary)
    # pipes in certain important cases.

    # If this process has been backgrounded, our stdin is invalid. Since there
    # is no compelling reason for the kernel to inherit our stdin anyway, we'll
    # place this one safe and always redirect.
    redirect_in = True
    _stdin = PIPE if stdin is None else stdin

    # If this process in running on pythonw, we know that stdin, stdout, and
    # stderr are all invalid.
    redirect_out = sys.executable.endswith("pythonw.exe")
    if redirect_out:
        blackhole = open(os.devnull, "w")
        _stdout = blackhole if stdout is None else stdout
        _stderr = blackhole if stderr is None else stderr
    else:
        _stdout, _stderr = stdout, stderr

    env = env if (env is not None) else os.environ.copy()

    encoding = getdefaultencoding(prefer_stream=False)
    kwargs = kw.copy()
    main_args = dict(stdin=_stdin, stdout=_stdout,
                     stderr=_stderr, cwd=cwd, env=env,)
    kwargs.update(main_args)

    # Spawn a kernel.
    if sys.platform == "win32":
        # Popen on Python 2 on Windows cannot handle unicode args or cwd
        cmd = [cast_bytes_py2(c, encoding) for c in cmd]
        if cwd:
            cwd = cast_bytes_py2(cwd, sys.getfilesystemencoding() or "ascii")
            kwargs["cwd"] = cwd

        from .win_interrupt import create_interrupt_event

        # Create a Win32 event for interrupting the kernel
        # and store it in an environment variable.
        interrupt_event = create_interrupt_event()
        env["JPY_INTERRUPT_EVENT"] = str(interrupt_event)
        # deprecated old env name:
        env["IPY_INTERRUPT_EVENT"] = env["JPY_INTERRUPT_EVENT"]

        try:
            from _winapi import (
                DuplicateHandle,
                GetCurrentProcess,
                DUPLICATE_SAME_ACCESS,
                CREATE_NEW_PROCESS_GROUP,
            )
        except:
            from _subprocess import (
                DuplicateHandle,
                GetCurrentProcess,
                DUPLICATE_SAME_ACCESS,
                CREATE_NEW_PROCESS_GROUP,
            )

        # create a handle on the parent to be inherited
        if independent:
            kwargs["creationflags"] = CREATE_NEW_PROCESS_GROUP
        else:
            pid = GetCurrentProcess()
            handle = DuplicateHandle(
                pid,
                pid,
                pid,
                0,
                True,  # Inheritable by new processes.
                DUPLICATE_SAME_ACCESS,
            )
            env["JPY_PARENT_PID"] = str(int(handle))

        # Prevent creating new console window on pythonw
        if redirect_out:
            kwargs["creationflags"] = (
                kwargs.setdefault("creationflags", 0) | 0x08000000
            )  # CREATE_NO_WINDOW

        # Avoid closing the above parent and interrupt handles.
        # close_fds is True by default on Python >=3.7
        # or when no stream is captured on Python <3.7
        # (we always capture stdin, so this is already False by default on <3.7)
        kwargs["close_fds"] = False
    else:
        # Create a new session.
        # This makes it easier to interrupt the kernel,
        # because we want to interrupt the whole process group.
        # We don't use setpgrp, which is known to cause problems for kernels starting
        # certain interactive subprocesses, such as bash -i.
        kwargs["start_new_session"] = True
        if not independent:
            env["JPY_PARENT_PID"] = str(os.getpid())

    try:
        proc = Popen(cmd, **kwargs)
    except Exception as exc:
        msg = (
            "Failed to run command:\n{}\n" "    PATH={!r}\n" "    with kwargs:\n{!r}\n"
        )
        # exclude environment variables,
        # which may contain access tokens and the like.
        without_env = {key: value for key,
                       value in kwargs.items() if key != "env"}
        msg = msg.format(cmd, env.get("PATH", os.defpath), without_env)
        raise

    if sys.platform == "win32":
        # Attach the interrupt event to the Popen objet so it can be used later.
        proc.win32_interrupt_event = interrupt_event

    # Clean up pipes created to work around Popen bug.
    if redirect_in:
        if stdin is None:
            proc.stdin.close()

    return proc


__all__ = [
    "launch_kernel",
]
