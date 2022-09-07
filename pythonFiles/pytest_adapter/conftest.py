import os
import sys

import pytest

sys.path.append(
    "/Users/eleanorboyd/.vscode/extensions/ms-python.python-2022.12.1/pythonFiles/lib/python"
)  #
import debugpy

debugpy.connect(5678)


@pytest.hookimpl()
def pytest_sessionstart(session):
    print("hello")


def pytest_collection_finish(session):
    print("end collection")
    for item in session.items:
        print("**")
        parentCur = item.parent
        path = str(item.name) + "> "
        while parentCur != None:
            path += str(parentCur.name) + "> "
            parentCur = parentCur.parent
        print("P:", path)
