# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os
import pathlib
import nox
import shutil
import sys
import sysconfig
import uuid

EXT_ROOT = pathlib.Path(__file__).parent


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
def azure_pet_build_before(session: nox.Session):
    source_dir = pathlib.Path(pathlib.Path.cwd() / "python-env-tools").resolve()
    config_toml_disabled = source_dir / ".cargo" / "config.toml.disabled"
    config_toml = source_dir / ".cargo" / "config.toml"
    if config_toml_disabled.exists() and not config_toml.exists():
        config_toml.write_bytes(config_toml_disabled.read_bytes())


@nox.session()
def azure_pet_build_after(session: nox.Session):
    source_dir = pathlib.Path(pathlib.Path.cwd() / "python-env-tools").resolve()
    ext = sysconfig.get_config_var("EXE") or ""
    bin_name = f"pet{ext}"

    abs_bin_path = None
    for root, _, files in os.walk(os.fspath(source_dir / "target")):
        bin_path = pathlib.Path(root) / "release" / bin_name
        if bin_path.exists():
            abs_bin_path = bin_path.absolute()
            break

    assert abs_bin_path

    dest_dir = pathlib.Path(pathlib.Path.cwd() / "python-env-tools").resolve()
    if not pathlib.Path(dest_dir / "bin").exists():
        pathlib.Path(dest_dir / "bin").mkdir()
    bin_dest = dest_dir / "bin" / bin_name
    shutil.copyfile(abs_bin_path, bin_dest)

    if sys.platform != "win32":
        shutil.chmod(bin_dest, 0o755)


@nox.session()
def native_build(session: nox.Session):
    source_dir = pathlib.Path(pathlib.Path.cwd() / "python-env-tools").resolve()
    dest_dir = pathlib.Path(pathlib.Path.cwd() / "python-env-tools").resolve()

    with session.cd(source_dir):
        if not pathlib.Path(dest_dir / "bin").exists():
            pathlib.Path(dest_dir / "bin").mkdir()

        if not pathlib.Path(dest_dir / "bin" / ".gitignore").exists():
            pathlib.Path(dest_dir / "bin" / ".gitignore").write_text(
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
                external=True,
            )
            source = source_dir / "target" / target / "release" / f"pet{ext}"
        else:
            session.run(
                "cargo",
                "build",
                "--frozen",
                "--release",
                external=True,
            )
            source = source_dir / "target" / "release" / f"pet{ext}"
        dest = dest_dir / "bin" / f"pet{ext}"
        shutil.copy(source, dest)

    # Remove python-env-tools/bin exclusion from .vscodeignore
    vscode_ignore = EXT_ROOT / ".vscodeignore"
    remove_patterns = ("python-env-tools/bin/**",)
    lines = vscode_ignore.read_text(encoding="utf-8").splitlines()
    filtered_lines = [line for line in lines if not line.startswith(remove_patterns)]
    vscode_ignore.write_text("\n".join(filtered_lines) + "\n", encoding="utf-8")


def delete_dir(path: pathlib.Path, ignore_errors=None):
    attempt = 0
    known = []
    while attempt < 5:
        try:
            shutil.rmtree(os.fspath(path), ignore_errors=ignore_errors)
            return
        except PermissionError as pe:
            if os.fspath(pe.filename) in known:
                break
            print(f"Changing permissions on {pe.filename}")
            os.chmod(pe.filename, 0o666)

    shutil.rmtree(os.fspath(path))


@nox.session()
def checkout_native(session: nox.Session):
    dest = (pathlib.Path.cwd() / "python-env-tools").resolve()
    if dest.exists():
        shutil.rmtree(os.fspath(dest))

    tempdir = os.getenv("TEMP") or os.getenv("TMP") or "/tmp"
    tempdir = pathlib.Path(tempdir) / str(uuid.uuid4()) / "python-env-tools"
    tempdir.mkdir(0o666, parents=True)

    session.log(f"Temp dir: {tempdir}")

    session.log(f"Cloning python-environment-tools to {tempdir}")
    try:
        with session.cd(tempdir):
            session.run("git", "init", external=True)
            session.run(
                "git",
                "remote",
                "add",
                "origin",
                "https://github.com/microsoft/python-environment-tools",
                external=True,
            )
            session.run("git", "fetch", "origin", "main", external=True)
            session.run(
                "git", "checkout", "--force", "-B", "main", "origin/main", external=True
            )
            delete_dir(tempdir / ".git")
            delete_dir(tempdir / ".github")
            delete_dir(tempdir / ".vscode")
            (tempdir / "CODE_OF_CONDUCT.md").unlink()
            shutil.move(os.fspath(tempdir), os.fspath(dest))
    except PermissionError as e:
        print(f"Permission error: {e}")
        if not dest.exists():
            raise
    finally:
        delete_dir(tempdir.parent, ignore_errors=True)


@nox.session()
def setup_repo(session: nox.Session):
    install_python_libs(session)
    checkout_native(session)
    native_build(session)
