# -*- coding: utf-8 -*-
import pytest


def pytest_addoption(parser):
    group = parser.getgroup("vscode-integration")
    group.addoption(
        "--foo",
        action="store",
        dest="dest_foo",
        default="2022",
        help='Set the value for the fixture "bar".',
    )

    parser.addini("HELLO", "Dummy pytest.ini setting")


@pytest.fixture
def bar(request):
    return request.config.option.dest_foo


def pytest_configure(config):
    print("ALERT!! in plugin configure", config)
    print("args", config.args)
    print("options T", type(config.option))


#     # called for running each test in 'a' directory
#     print("AAAAA: setting up", item)


def pytest_collection_finish(session):
    print("ALERT!! in plugin  file file ")


# def pytest_collectstart(collector):
#     c = collector
#     print("collector", c)
#     print("ALERT!! in plugin collector start")


# def pytest_addoption(parser, pluginmanager):
#     print("parser xtra info", parser.extra_info)

#     print("pluginmanager", pluginmanager)


def get_config(request):
    print("ABCD request,", request.config)
