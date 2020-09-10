# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import json
import logging
import os
import os.path
import signal
import sys

# Only subprocess.PIPE is used in this file so we can ignore the subprocess warning for this file
# The actual POpen is in kernel_launcher.py
import subprocess  # nosec
import threading
import time
from vscode_datascience_helpers.daemon.daemon_python import (
    error_decorator,
    PythonDaemon as BasePythonDaemon,
    change_exec_context,
)
from vscode_datascience_helpers.jupyter_daemon import PythonDaemon as JupyterDaemon
from vscode_datascience_helpers.kernel_launcher import launch_kernel


class PythonDaemon(JupyterDaemon):
    def __init__(self, rx, tx):
        super().__init__(rx, tx)
        self.killing_kernel = False
        self.log.info("DataScience Kernel Launcher Daemon init")

    def close(self):
        """Ensure we kill the kernel when shutting down the daemon."""
        try:
            self.m_kill_kernel()
            """ We don't care about exceptions coming back from killing the kernel, so pass here """
        except:  # nosec
            pass
        super().close()

    @error_decorator
    def m_interrupt_kernel(self):
        """Interrupts the kernel by sending it a signal.
        Unlike ``signal_kernel``, this operation is well supported on all
        platforms.
        Borrowed from https://github.com/jupyter/jupyter_client/blob/master/jupyter_client/manager.py
        """
        self.log.info("Interrupt kernel in DS Kernel Launcher Daemon")
        if self.kernel is not None:
            if sys.platform == "win32":
                self.log.debug("Interrupt kernel on Windows")
                from vscode_datascience_helpers.win_interrupt import send_interrupt

                send_interrupt(self.kernel.win32_interrupt_event)
            else:
                self.log.debug("Interrupt kernel with SIGINT")
                self.signal_kernel(signal.SIGINT)

    @error_decorator
    def m_kill_kernel(self):
        """Interrupts the kernel by sending it a signal.
        Unlike ``signal_kernel``, this operation is well supported on all
        platforms.
        Borrowed from https://github.com/jupyter/jupyter_client/blob/master/jupyter_client/manager.py
        """
        self.log.info("Kill kernel in DS Kernel Launcher Daemon")
        self.killing_kernel = True
        if self.kernel is not None:
            # Signal the kernel to terminate (sends SIGKILL on Unix and calls
            # TerminateProcess() on Win32).
            try:
                if hasattr(signal, "SIGKILL"):
                    self.signal_kernel(signal.SIGKILL)
                else:
                    self.kernel.kill()
            except OSError:
                pass

    @error_decorator
    def m_prewarm_kernel(self):
        """Starts the kernel process with the module"""
        self.log.info("Pre-Warm DS Kernel in DS Kernel Launcher Daemon")
        isolated_runner = os.path.join(
            os.path.dirname(__file__), "..", "pyvsc-run-isolated.py"
        )
        kernel_prewarm_starter = os.path.join(
            os.path.dirname(__file__), "kernel_prewarm_starter.py"
        )

        def prewarm_kernel():
            cmd = [sys.executable, isolated_runner, kernel_prewarm_starter]
            self._start_kernel_observable_in_background(cmd)
            self.log.info("Kernel launched, with PID as a daemon %s", self.kernel.pid)

        return self._execute_and_capture_output(prewarm_kernel)

    @error_decorator
    def m_start_prewarmed_kernel(self, args=[]):
        """Starts the pre-warmed kernel process."""
        self.log.info(
            "Start pre-warmed Kernel in DS Kernel Launcher Daemon %s with args %s",
            self.kernel.pid,
            args,
        )

        def start_kernel():
            self.kernel.stdin.write(
                "{0}{1}".format(json.dumps(args), os.linesep).encode("utf-8")
            )
            self.kernel.stdin.close()

        return self._execute_and_capture_output(start_kernel)

    @error_decorator
    def m_exec_module(self, module_name, args=[], cwd=None, env=None):
        """Override default behavior to run the ipykernel module in a background thread."""
        args = [] if args is None else args
        self.log.info(
            "Exec module in DS Kernel Launcher Daemon %s with args %s",
            module_name,
            args,
        )

        def start_kernel():
            self._exec_module_observable_in_background(module_name, args, cwd, env)

        return self._execute_and_capture_output(start_kernel)

    def _read_stderr_in_background(self):
        while self.kernel.poll() is None:
            stderr_output = self.kernel.stderr.readline()
            if stderr_output:
                sys.stderr.write(stderr_output)
                sys.stderr.flush()

    def _read_stdout_in_background(self):
        while self.kernel.poll() is None:
            stdout_output = self.kernel.stdout.readline()
            if stdout_output:
                sys.stdout.write(stdout_output)
                sys.stdout.flush()

    def _monitor_kernel(self):
        self.log.warn("Waiting for Kernel to die %s", self.kernel.pid)
        self.kernel.wait(timeout=None)

        exit_code = self.kernel.poll()
        std_err = self.kernel.stderr.read()
        if std_err is not None:
            std_err = std_err.decode("utf-8")
        self.log.warn("Kernel has exited with exit code %s, %s", exit_code, std_err)
        sys.stdout.flush()
        sys.stderr.flush()
        self._endpoint.notify(
            "kernel_died", {"exit_code": exit_code, "reason": std_err}
        )

    def _exec_module_observable_in_background(
        self, module_name, args=None, cwd=None, env=None
    ):
        self.log.info(
            "Exec in DS Kernel Launcher Daemon (observable) %s with args %s",
            module_name,
            args,
        )
        args = [] if args is None else args
        cmd = [sys.executable, "-m", module_name] + args
        self._start_kernel_observable_in_background(cmd, cwd, env)
        self.kernel.stdin.close()

    def _start_kernel_observable_in_background(self, cmd, cwd=None, env=None):
        self.log.info(
            "Exec in DS Kernel Launcher Daemon (observable) %s",
            cmd,
        )
        # As the kernel is launched from this same python executable, ensure the kernel variables
        # are merged with the variables of this current environment.
        new_env_vars = {} if env is None else env
        env = os.environ.copy()
        env.update(new_env_vars)
        proc = launch_kernel(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            stdin=subprocess.PIPE,
            cwd=cwd,
            env=env,
            independent=False,
        )
        self.log.info("Exec in DS Kernel Launcher Daemon (observable)")

        self.kernel = proc
        self.log.info("Kernel launched, with PID %s", proc.pid)

        threading.Thread(
            target=self._read_stdout_in_background,
            daemon=True,
            name="kerne_stdout_reader",
        ).start()
        threading.Thread(
            target=self._read_stderr_in_background,
            daemon=True,
            name="kerne_stderr_reader",
        ).start()
        threading.Thread(
            target=self._monitor_kernel, daemon=True, name="kerne_monitor"
        ).start()

        # We could wait for 0.5-1s to ensure kernel doesn't die, however that will not work.
        # On windows, launching a conda process can take 4s, hence just spinning up a process takes 4s
        # and then python will attempt to run the kernel module, at which point it could fail.
        # Meaning there's no way to know it successfully launched the kernel without trying to connect to it.

    def signal_kernel(self, signum):
        """Sends a signal to the process group of the kernel (this
        usually includes the kernel and any subprocesses spawned by
        the kernel).
        Note that since only SIGTERM is supported on Windows, this function is
        only useful on Unix systems.
        """
        if self.kernel is not None:
            if hasattr(os, "getpgid") and hasattr(os, "killpg"):
                try:
                    pgid = os.getpgid(self.kernel.pid)
                    os.killpg(pgid, signum)
                    self.log.debug(
                        "Signalled kernel PID %s, with %s", self.kernel.pid, signum
                    )
                    return
                except OSError:
                    self.log.debug(
                        "Failed to signal kernel PID %s, with %s",
                        self.kernel.pid,
                        signum,
                    )
                    pass
            self.log.debug(
                "Signalling kernel with using send_signal PID %s, with %s",
                self.kernel.pid,
                signum,
            )
            self.kernel.send_signal(signum)
