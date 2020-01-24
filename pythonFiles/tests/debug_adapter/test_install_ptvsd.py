import os
import pytest
import subprocess
import sys


def _check_binaries(dir_path):
    expected_endswith = (
        "win_amd64.pyd",
        "win32.pyd",
        "darwin.so",
        "i386-linux-gnu.so",
        "x86_64-linux-gnu.so",
    )

    binaries = list(p for p in os.listdir(dir_path) if p.endswith(expected_endswith))

    assert len(binaries) == len(expected_endswith)


@pytest.mark.skipif(
    sys.version_info[:2] != (3, 7), reason="PTVSD wheels shipped for Python 3.7 only",
)
def test_install_ptvsd(tmpdir):
    import install_ptvsd

    install_ptvsd.main(str(tmpdir))
    dir_path = os.path.join(
        str(tmpdir), "ptvsd", "_vendored", "pydevd", "_pydevd_bundle"
    )
    _check_binaries(dir_path)

    dir_path = os.path.join(
        str(tmpdir), "ptvsd", "_vendored", "pydevd", "_pydevd_frame_eval"
    )
    _check_binaries(dir_path)
