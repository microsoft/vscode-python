# -*- coding: utf-8 -*-
import json
import os
import sys

import pytest

sys.path.append(
    "/Users/eleanorboyd/.vscode/extensions/ms-python.python-2022.12.1/pythonFiles/lib/python"
)  #
# import debugpy

# debugpy.connect(5678)

# Add the path to pythonFiles to sys.path to find testing_tools.socket_manager.
PYTHON_FILES = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
print("ALERT!! in plugin", PYTHON_FILES)
sys.path.insert(0, PYTHON_FILES)

from testing_tools import socket_manager

# If I use from utils then there will be an import error in test_discovery.py.
from unittest_adapter.utils import TestNode, build_test_tree, parse_unittest_args

# Add the lib path to sys.path to find the typing_extensions module.
sys.path.insert(0, os.path.join(PYTHON_FILES, "lib", "python"))

from typing_extensions import NotRequired

DEFAULT_PORT = "45454"


def pytest_addoption(parser):
    group = parser.getgroup("vscode-integration")
    group.addoption(
        "--port",
        action="store",
        dest="port_arg",
        default="500",
        help="Get the port value to send back data to.",
    )


# parser.addini("HELLO", "Dummy pytest.ini setting")


# @pytest.fixture
# def bar(request):
#     return request.config.option.dest_foo


def pytest_configure(config):
    # print("ALERT!! in plugin configure", config)
    # print("args", config.args)
    inputArgs = vars(config.option)
    port = inputArgs["port_arg"]
    print("portValue", port)


#     # called for running each test in 'a' directory
#     print("AAAAA: setting up", item)


def pytest_collection_finish(session):
    print("end collection")
    testsList = []
    for item in session.items:
        parentCur = item.parent
        path = str(item.name)
        while parentCur != session:
            path = str(parentCur.name) + "::" + path
            parentCur = parentCur.parent
        testsList.append(path)
    print("final tests collected", testsList)
    sendPost()


# def pytest_collectstart(collector):
#     c = collector
#     print("collector", c)
#     print("ALERT!! in plugin collector start")


# def pytest_addoption(parser, pluginmanager):
#     print("parser xtra info", parser.extra_info)

#     print("pluginmanager", pluginmanager)


# def get_config(request):
#     print("ABCD request,", request.config)


def sendPost():
    payload: dict = {"status": "success"}
    addr = ("localhost", 45454)
    print("sending post")
    # socket_manager.send_post("Hello from pytest")  # type: ignore
    with socket_manager.SocketManager(addr) as s:
        request = json.dumps(payload)
        result = s.socket.sendall(request.encode("utf-8"))  # type: ignore
