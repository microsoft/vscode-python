import argparse
import datetime
import json
import os

EXT_ROOT = os.path.dirname(os.path.dirname(__file__))
PACKAGE_JSON_PATH = os.path.join(EXT_ROOT, "package.json")


def get_argparse():
    parser = argparse.ArgumentParser(
        description="This script updates the python extension micro version based on the release or pre-release channel."
    )
    parser.add_argument(
        "--release",
        action="store_true",
        help="Treats the current build is a release build.",
    )
    parser.add_argument(
        "--build-id",
        action="store",
        type=int,
        default=None,
        help="If persent will be used as a micro version.",
        required=False,
    )
    parser.add_argument(
        "--for-publishing",
        action="store_true",
        help="Preserves `-dev` or `-rc` suffix.",
    )
    return parser


def is_even(v):
    return int(v) % 2 == 0


def get_build_number():
    return "1" + datetime.datetime.now(tz=datetime.timezone.utc).strftime("%j%H%M")


def parse_version(version):
    major, minor, parts = version.split(".")
    try:
        micro, suffix = parts.split("-")
    except Exception:
        micro = parts
        suffix = ""
    return (major, minor, micro, suffix)


def main():
    parser = get_argparse()
    args = parser.parse_args()

    with open(PACKAGE_JSON_PATH, "r", encoding="utf-8") as f:
        package = json.load(f)

    major, minor, micro, suffix = parse_version(package["version"])

    if args.release and not is_even(minor):
        raise Exception(
            "Release version should have EVEN numbered minor version: {}".format(
                package["version"]
            )
        )

    if not args.release and is_even(minor):
        raise Exception(
            "Pre-release version should have ODD numbered minor version: {}".format(
                package["version"]
            )
        )

    print("Updating build FROM: {}".format(package["version"]))
    if args.build_id:
        # If build id is provided it should fall within the 0-INT32 max range
        # that the max allowed value for publishing to market place
        if args.for_publishing and (
            args.build_id < 0 or args.build_id > ((2**32) - 1)
        ):
            raise Exception("Build ID must be within [0, {}]".format((2**32) - 1))

        package["version"] = "{}.{}.{}".format(major, minor, args.build_id)
    elif args.release:
        package["version"] = "{}.{}.{}".format(major, minor, micro)
    else:
        # micro version only updated for pre-release
        package["version"] = "{}.{}.{}".format(major, minor, get_build_number())

    if not args.for_publishing and not args.release and len(suffix) > 0:
        package["version"] += "-" + suffix
    print("Updating build TO: {}".format(package["version"]))

    with open(PACKAGE_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(package, f, indent=4, ensure_ascii=False)
        print("", file=f)  # add a new line at the end of the file


if __name__ == "__main__":
    main()
