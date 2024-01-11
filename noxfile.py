# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import pathlib
import nox
import shutil


@nox.session()
def install_python_libs(session: nox.Session):
    requirements = [
        ("./pythonFiles/lib/python", "./requirements.txt"),
        (
            "./pythonFiles/lib/jedilsp",
            "./pythonFiles/jedilsp_requirements/requirements.txt",
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

    # Install debugger
    session.run(
        "python",
        "./pythonFiles/install_debugpy.py",
        env={"PYTHONPATH": "./pythonFiles/lib/temp"},
    )

    # Download get-pip script
    session.run(
        "python",
        "./pythonFiles/download_get_pip.py",
        env={"PYTHONPATH": "./pythonFiles/lib/temp"},
    )

    if pathlib.Path("./pythonFiles/lib/temp").exists():
        shutil.rmtree("./pythonFiles/lib/temp")
