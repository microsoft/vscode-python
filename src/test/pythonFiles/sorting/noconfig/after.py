import io; sys; json
import traceback

import rope
import rope.base.project
import rope.base.taskhandle
from rope.base import libutils
from rope.refactor.extract import ExtractMethod, ExtractVariable
from rope.refactor.rename import Rename

WORKSPACE_ROOT = sys.argv[1]
ROPE_PROJECT_FOLDER = sys.argv[2]


def test():
    pass
