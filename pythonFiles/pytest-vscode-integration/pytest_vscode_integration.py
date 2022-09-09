# -*- coding: utf-8 -*-
import pytest


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


# def pytest_collectstart(collector):
#     c = collector
#     print("collector", c)
#     print("ALERT!! in plugin collector start")


# def pytest_addoption(parser, pluginmanager):
#     print("parser xtra info", parser.extra_info)

#     print("pluginmanager", pluginmanager)


# def get_config(request):
#     print("ABCD request,", request.config)
