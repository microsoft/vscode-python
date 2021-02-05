import sys
import os

# Add the lib path to our sys path so jedi_language_server can find its references
EXTENSION_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(EXTENSION_ROOT, "pythonFiles", "lib", "python"))

import pygls.protocol

try:
    import __builtin__ as builtins
except ImportError:
    import builtins

try:
    unicode = builtins.unicode
except AttributeError:
    unicode = builtins.str


def is_json_basic_type(obj):
    """Checks if the object is an int, float, bool, or str."""
    return isinstance(obj, (int, float, bool, str, unicode))


def remove_null_fields(obj, obj_field_name=None):
    """Removes fields with a 'None' value.

    The LS Client in VS Code expects optional fields that are not needed
    to be omitted. Unfortunately, pygls uses 'null' in these instances.
    """
    # This is a temporary workaround to address the following issues:
    #   https://github.com/microsoft/vscode-languageserver-node/issues/740#issuecomment-773967897
    #   https://github.com/pappasam/jedi-language-server/issues/60
    #   https://github.com/openlawlibrary/pygls/issues/145
    #   https://github.com/microsoft/vscode-languageserver-node/issues/740
    if is_json_basic_type(obj):
        return
    elif isinstance(obj, list):
        for o in obj:
            remove_null_fields(o, obj_field_name)
        return

    # We need this as a list for now so we can check for the special case with
    # textDocument object
    attributes = [
        attr
        for attr in dir(obj)
        if not attr.startswith("_") and not callable(getattr(obj, attr))
    ]

    for attr in attributes:
        member = getattr(obj, attr)
        if member is None:
            # This is a special condition to handle VersionedTextDocumentIdentifier object.
            # See issues:
            # https://github.com/pappasam/jedi-language-server/issues/61
            # https://github.com/openlawlibrary/pygls/issues/146
            #
            # The version field should either use `0` or the value received from `client`.
            # Seems like using `null` or removing this causes VS Code to ignore
            # code actions.
            if (
                attr == "version"
                and obj_field_name == "textDocument"
                and "uri" in attributes
            ):
                setattr(obj, "version", 0)
            else:
                delattr(obj, attr)

        elif is_json_basic_type(member):
            continue

        else:
            remove_null_fields(member, attr)


def patched_without_none_fields(resp):
    """Monkeypatch for `JsonRPCResponseMessage.without_none_fields` to remove `None` results."""
    if resp.error is None:
        del resp.error
        if hasattr(resp, "result"):
            remove_null_fields(resp.result)
    else:
        del resp.result
    return resp


pygls.protocol.JsonRPCResponseMessage.without_none_fields = patched_without_none_fields


from jedi_language_server.cli import cli

sys.exit(cli())
