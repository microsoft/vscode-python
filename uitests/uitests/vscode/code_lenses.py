# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


from . import core


def get_code_lenses(context, **kwargs):
    selector = ".editor-container .monaco-editor .lines-content .codelens-decoration a"

    return core.wait_for_elements(context.driver, selector, **kwargs)
