import sys
from os import path

ROOT = path.dirname(path.dirname(path.abspath(__file__)))
PYTHONFILES = path.join(ROOT, "pythonFiles", "lib", "python")
REQUIREMENTS = path.join(ROOT, "requirements.txt")

sys.path.insert(0, PYTHONFILES)

from packaging.tags import sys_tags
from packaging.requirements import Requirement


def ptvsd_folder_name():
    """Return the folder name for the bundled PTVSD wheel compatible with the new debug adapter."""

    with open(REQUIREMENTS, "r", encoding="utf-8") as reqsfile:
        for line in reqsfile:
            pkgreq = Requirement(line)
            if pkgreq.name == "ptvsd":
                specs = pkgreq.specifier
                version = next(iter(specs)).version
                break

    sys.path.remove(PYTHONFILES)

    for tag in sys_tags():
        folder_name = f"ptvsd-{version}-{tag.interpreter}-{tag.abi}-{tag.platform}"
        folder_path = path.join(PYTHONFILES, folder_name)
        if path.exists(folder_path):
            print(folder_path)
            return

    # Fallback to use base PTVSD path.
    print(PYTHONFILES)


if __name__ == "__main__":
    ptvsd_folder_name()
