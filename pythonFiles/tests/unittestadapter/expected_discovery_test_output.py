# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os
from unittestadapter.utils import TestNodeTypeEnum
from .helpers import TEST_DATA_PATH

skip_unittest_folder_discovery_output = {
    "path": os.fspath(TEST_DATA_PATH / "unittest_skip"),
    "name": "unittest_skip",
    "type_": TestNodeTypeEnum.folder,
    "children": [
        {
            "path": os.fspath(
                TEST_DATA_PATH / "unittest_skip" / "unittest_skip_file.py"
            ),
            "name": "unittest_skip_file.py",
            "type_": TestNodeTypeEnum.file,
            "children": [],
            "id_": os.fspath(
                TEST_DATA_PATH / "unittest_skip" / "unittest_skip_file.py"
            ),
        },
        {
            "path": os.fspath(
                TEST_DATA_PATH / "unittest_skip" / "unittest_skip_function.py"
            ),
            "name": "unittest_skip_function.py",
            "type_": TestNodeTypeEnum.file,
            "children": [
                {
                    "path": os.fspath(
                        TEST_DATA_PATH / "unittest_skip" / "unittest_skip_function.py"
                    ),
                    "name": "SimpleTest",
                    "type_": TestNodeTypeEnum.class_,
                    "children": [
                        {
                            "name": "testadd1",
                            "path": os.fspath(
                                TEST_DATA_PATH
                                / "unittest_skip"
                                / "unittest_skip_function.py"
                            ),
                            "lineno": "13",
                            "type_": TestNodeTypeEnum.test,
                            "id_": os.fspath(
                                TEST_DATA_PATH
                                / "unittest_skip"
                                / "unittest_skip_function.py"
                            )
                            + "\\SimpleTest\\testadd1",
                            "runID": "unittest_skip_function.SimpleTest.testadd1",
                        }
                    ],
                    "id_": os.fspath(
                        TEST_DATA_PATH / "unittest_skip" / "unittest_skip_function.py"
                    )
                    + "\\SimpleTest",
                }
            ],
            "id_": os.fspath(
                TEST_DATA_PATH / "unittest_skip" / "unittest_skip_function.py"
            ),
        },
    ],
    "id_": os.fspath(TEST_DATA_PATH / "unittest_skip"),
}
