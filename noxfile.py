# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import pathlib
import nox
import shutil


@nox.session()
def install_python_libs(session: nox.Session):
    requirements = [
        ("./python_files/lib/python", "./requirements.txt"),
        (
            "./python_files/lib/jedilsp",
            "./python_files/jedilsp_requirements/requirements.txt",
        ),
    ]
    for target, file in requirements:
        session.install(
            "-t",
            target,
            "--no-cache-dir",
            "--implementation",
            "py",
            "--no-deps",
            "--require-hashes",
            "--only-binary",
            ":all:",
            "-r",
            file,
        )

    session.install("packaging")

    # Download get-pip script
    session.run(
        "python",
        "./python_files/download_get_pip.py",
        env={"PYTHONPATH": "./python_files/lib/temp"},
    )

    if pathlib.Path("./python_files/lib/temp").exists():
        shutil.rmtree("./python_files/lib/temp")
