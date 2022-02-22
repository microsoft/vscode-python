import argparse
import datetime
import json
import pathlib

EXT_ROOT = pathlib.Path(__file__).parent.parent
PACKAGE_JSON_PATH = EXT_ROOT / "package.json"


def build_arg_parse():
    """Builds arguments parser for the following arguments.
        --release: Validates release version number.
        --build-id: Custom <micro> version for the build.
        --for-publishing: Ensures that the version is parseable by marketplace.
    """
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
        help="If present will be used as a micro version.",
        required=False,
    )
    parser.add_argument(
        "--for-publishing",
        action="store_true",
        help="Removes `-dev` or `-rc` suffix.",
    )
    return parser


def is_even(v):
    """Returns True if `v` is even.
    """
    return not int(v) % 2


def micro_build_number():
    """Generates micro build number using the following format:
    1 + <Julian day> + <hour> + <minute>
    """
    return f"1{datetime.datetime.now(tz=datetime.timezone.utc).strftime('%j%H%M')}"


def parse_version(version):
    """Returns a tuple of major, minor, micro and suffix from a given string
    """
    major, minor, parts = version.split(".",maxsplit=2)
    try:
        micro, suffix = parts.split("-", maxsplit=1)
    except ValueError:
        micro = parts
        suffix = ""
    return (major, minor, micro, suffix)


def main():
    parser = build_arg_parse()
    args = parser.parse_args()

    package = json.loads(PACKAGE_JSON_PATH.read_text(encoding="utf-8"))

    major, minor, micro, suffix = parse_version(package["version"])

    if args.release and not is_even(minor):
         raise ValueError(
                f"Release version should have EVEN numbered minor version: {package['version']}"
            )
    elif not args.release and is_even(minor):
        raise ValueError(
                f"Pre-Release version should have ODD numbered minor version: {package['version']}"
            )


    print(f"Updating build FROM: {package['version']}")
    if args.build_id:
        # If build id is provided it should fall within the 0-INT32 max range
        # that the max allowed value for publishing to Marketplace.
        if args.for_publishing and (
            args.build_id < 0 or args.build_id > ((2**32) - 1)
        ):
            raise Exception("Build ID must be within [0, {}]".format((2**32) - 1))

        package["version"] = ".".join((major, minor, args.build_id))
    elif args.release:
        package["version"] = ".".join((major, minor, micro))
    else:
        # micro version only updated for pre-release.
        package["version"] = ".".join((major, minor, micro_build_number()))

    if not args.for_publishing and not args.release and len(suffix):
        package["version"] += "-" + suffix
    print(f"Updating build TO: {package['version']}")

    # Overwrite package.json with new data add a new-line at the end of the file.
    PACKAGE_JSON_PATH.write_text(json.dumps(package, indent=4, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
