import sys
import os

# Add the lib path to our sys path so jedi_language_server can find its references
EXTENSION_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(EXTENSION_ROOT, "pythonFiles", "lib", "python"))

import pygls.protocol


# This function is used to remove fields with 'None' value. This is a temporary
# workaround to address this issue:
# https://github.com/pappasam/jedi-language-server/issues/60
# https://github.com/openlawlibrary/pygls/issues/145
# https://github.com/microsoft/vscode/issues/115793
# Essentially the LS Client in VS Code expects optional fields that are not needed
# should be skipped. Currently in pygls options fields use 'null' value.
def remove_null_fields(obj, obj_field_name=None):
    if isinstance(obj, (int, float, bool, str)):
        return

    if isinstance(obj, list):
        for o in obj:
            remove_null_fields(o, obj_field_name)
        return

    attributes = [
        attr
        for attr in dir(obj)
        if not attr.startswith("_") and not callable(getattr(obj, attr))
    ]

    for attr in attributes:
        member = getattr(obj, attr)
        if member is None:
            # This is a special condition to handle VersionedTextDocumentIdentifier object.
            # See issue:
            # https://github.com/pappasam/jedi-language-server/issues/61
            # https://github.com/openlawlibrary/pygls/issues/146
            # The version field should either use `0` or value received from `client`.
            # Seems like using `null` or removing this here causes VS Code to ignore
            # code actions.
            if (
                attr == "version"
                and obj_field_name == "textDocument"
                and "uri" in attributes
            ):
                setattr(obj, "version", 0)
            else:
                delattr(obj, attr)
            continue

        if isinstance(member, (int, float, bool, str)):
            continue

        remove_null_fields(member, attr)


# `without_none_fields` method only removes None fields from the top level
# protocol message object. Not from the result. Patch the `without_none_fields`
# method to additionally remove `none` from the result object.
without_none_fields = pygls.protocol.JsonRPCResponseMessage.without_none_fields


def patched_without_none_fields(resp):
    if hasattr(resp, "result"):
        remove_null_fields(resp.result)
    return without_none_fields(resp)


pygls.protocol.JsonRPCResponseMessage.without_none_fields = patched_without_none_fields


from jedi_language_server.cli import cli

sys.exit(cli())
