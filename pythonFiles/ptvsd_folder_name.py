import sys
from os import path

ROOT_DIRNAME = path.dirname(path.dirname(path.abspath(__file__)))
PYTHONFILES_PATH = path.join(ROOT_DIRNAME, "pythonFiles", "lib", "python")
REQUIREMENTS_PATH = path.join(ROOT_DIRNAME, "requirements.txt")

sys.path.insert(0, PYTHONFILES_PATH)

from packaging.tags import sys_tags
from packaging.requirements import Requirement


def ptvsd_folder_name():
    """Return the folder name for the bundled PTVSD wheel compatible with the new debug adapter."""

    with open(REQUIREMENTS_PATH, "r", encoding="utf-8") as requirements:
        for line in requirements:
            package_requirement = Requirement(line)
            if package_requirement.name != "ptvsd":
                continue
            requirement_specifier = package_requirement.specifier
            ptvsd_version = next(requirement_specifier.__iter__()).version

    sys.path.remove(PYTHONFILES_PATH)

    for tag in sys_tags():
        folder_name = (
            f"ptvsd-{ptvsd_version}-{tag.interpreter}-{tag.abi}-{tag.platform}"
        )
        folder_path = path.join(PYTHONFILES_PATH, folder_name)
        if path.exists(folder_path):
            print(folder_path)
            return

    # Fallback to use base PTVSD path.
    print(PYTHONFILES_PATH)


if __name__ == "__main__":
    ptvsd_folder_name()
