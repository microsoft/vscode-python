# import github
# import os

# GH = github.Github(os.getenv("GITHUB_ACCESS_TOKEN"))
# GH_REPO = GH.get_repo(os.getenv("GITHUB_REPOSITORY"))


import pathlib


def main():
    # load in list of packages and its version from requirements.txt that is in one directory above
    root_path = pathlib.Path(__file__).parent.parent.parent
    requirement_path = pathlib.Path(root_path, "requirements.txt").read_text(
        encoding="utf-8"
    )
    # with open(requirement_path, "r") as f:
    #     packages = f.readlines()
    #     packages = [package.strip() for package in packages]
    #     packages = [package.split("==") for package in packages]
    # print(packages)
    print(requirement_path)


if __name__ == "__main__":
    main()
