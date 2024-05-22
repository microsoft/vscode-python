# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os
import pathlib
import nox
import shutil
import sys
import sysconfig


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


@nox.session()
def native_build(session: nox.Session):
    with session.cd("./native_locator"):
        if not pathlib.Path(pathlib.Path.cwd() / "bin").exists():
            pathlib.Path(pathlib.Path.cwd() / "bin").mkdir()

        if not pathlib.Path(pathlib.Path.cwd() / "bin" / ".gitignore").exists():
            pathlib.Path(pathlib.Path.cwd() / "bin" / ".gitignore").write_text(
                "*\n", encoding="utf-8"
            )

        ext = sysconfig.get_config_var("EXE") or ""
        target = os.environ.get("CARGO_TARGET", None)

        session.run("cargo", "fetch", external=True)
        if target:
            session.run(
                "cargo",
                "build",
                "--frozen",
                "--release",
                "--target",
                target,
                "--package",
                "python-finder",
                external=True,
            )
            source = f"./target/{target}/release/python-finder{ext}"
            dest = f"./bin/python-finder{ext}"
            shutil.copy(source, dest)
        else:
            session.run(
                "cargo",
                "build",
                "--frozen",
                "--release",
                "--package",
                "python-finder",
                external=True,
            )

            source = f"./target/release/python-finder{ext}"
            dest = f"./bin/python-finder{ext}"
            shutil.copy(source, dest)


@nox.session()
def setup_repo(session: nox.Session):
    install_python_libs(session)
    native_build(session)
