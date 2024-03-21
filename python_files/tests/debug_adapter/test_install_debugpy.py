import os


def _check_binaries(dir_path):
    expected_endswith = (
        "win_amd64.pyd",
        "win32.pyd",
        "darwin.so",
        "x86_64-linux-gnu.so",
    )

    binaries = list(p for p in os.listdir(dir_path) if p.endswith(expected_endswith))

    assert len(binaries) == len(expected_endswith)


def test_install_debugpy(tmpdir):
    import install_debugpy

    install_debugpy.main(str(tmpdir))
    dir_path = os.path.join(str(tmpdir), "debugpy", "_vendored", "pydevd", "_pydevd_bundle")
    _check_binaries(dir_path)

    dir_path = os.path.join(str(tmpdir), "debugpy", "_vendored", "pydevd", "_pydevd_frame_eval")
    _check_binaries(dir_path)
