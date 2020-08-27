# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import argparse
import importlib
import json
import os
import logging
import logging.config
import sys


log = logging.getLogger(__name__)

LOG_FORMAT = (
    "%(asctime)s UTC - %(levelname)s - (PID: %(process)d) - %(name)s - %(message)s"
)
queue_handler = None


def add_arguments(parser):
    parser.description = "Daemon"

    parser.add_argument(
        "--daemon-module",
        default="vscode_datascience_helpers.daemon.daemon_python",
        help="Daemon Module",
    )

    log_group = parser.add_mutually_exclusive_group()
    log_group.add_argument(
        "--log-config", help="Path to a JSON file containing Python logging config."
    )
    log_group.add_argument(
        "--log-file",
        help="Redirect logs to the given file instead of writing to stderr."
        "Has no effect if used with --log-config.",
    )

    parser.add_argument(
        "-v",
        "--verbose",
        action="count",
        default=0,
        help="Increase verbosity of log output, overrides log config file",
    )


class TemporaryQueueHandler(logging.Handler):
    """Logger used to temporarily store everything into a queue.
    Later the messages are pushed back to the RPC client as a notification.
    Once the RPC channel is up, we'll stop queuing messages and sending id directly.
    """

    def __init__(self):
        logging.Handler.__init__(self)
        self.queue = []
        self.server = None

    def set_server(self, server):
        # Send everything that has beeen queued until now.
        self.server = server
        for msg in self.queue:
            self.server._endpoint.notify("log", msg)
        self.queue = []

    def emit(self, record):
        data = {
            "level": record.levelname,
            "msg": self.format(record),
            "pid": os.getpid(),
        }
        # If we don't have the server, then queue it and send it later.
        if self.server is None:
            self.queue.append(data)
        else:
            self.server._endpoint.notify("log", data)


def _configure_logger(verbose=0, log_config=None, log_file=None):
    root_logger = logging.root
    global queue_handler
    if log_config:
        with open(log_config, "r") as f:
            logging.config.dictConfig(json.load(f))
    else:
        formatter = logging.Formatter(LOG_FORMAT)
        if log_file:
            log_handler = logging.handlers.RotatingFileHandler(
                log_file,
                mode="a",
                maxBytes=50 * 1024 * 1024,
                backupCount=10,
                encoding=None,
                delay=0,
            )
            log_handler.setFormatter(formatter)
            root_logger.addHandler(log_handler)
        else:
            queue_handler = TemporaryQueueHandler()
            root_logger.addHandler(queue_handler)

    if verbose == 0:
        level = logging.WARNING
    elif verbose == 1:
        level = logging.INFO
    elif verbose >= 2:
        level = logging.DEBUG

    root_logger.setLevel(level)


def main():
    """Starts the daemon.
    The daemon_module allows authors of modules to provide a custom daemon implementation.
    E.g. we have a base implementation for standard python functionality,
    and a custom daemon implementation for DS work (related to jupyter).
    """
    parser = argparse.ArgumentParser()
    add_arguments(parser)
    args = parser.parse_args()
    _configure_logger(args.verbose, args.log_config, args.log_file)

    log.info("Starting daemon from %s.PythonDaemon", args.daemon_module)
    try:
        daemon_module = importlib.import_module(args.daemon_module)
        daemon_cls = daemon_module.PythonDaemon
        daemon_cls.start_daemon(queue_handler)
    except Exception:
        import traceback

        log.error(traceback.format_exc())
        raise Exception("Failed to start daemon")


if __name__ == "__main__":
    main()
