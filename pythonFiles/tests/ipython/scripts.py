# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
import re
import os
import json
import sys
import imp


def check_for_ipython():
    if int(sys.version[0]) >= 3:
        try:
            from IPython import get_ipython

            return not get_ipython() == None
        except ImportError:
            pass
    return False


def execute_script(file, replace_dict=dict([])):
    from IPython import get_ipython

    regex = (
        re.compile("|".join(replace_dict.keys()))
        if len(replace_dict.keys()) > 0
        else None
    )

    # Open the file. Read all lines into a string
    contents = ""
    with open(file, "r") as fp:
        for line in fp:
            # Replace the key value pairs
            contents += (
                line
                if regex == None
                else regex.sub(lambda m: replace_dict[m.group()], line)
            )

    # Execute this script as a cell
    result = get_ipython().run_cell(contents)
    return result.success


def execute_code(code):
    # Execute this script as a cell
    result = get_ipython().run_cell(code)
    return result


def get_variables(capsys):
    path = os.path.dirname(os.path.abspath(__file__))
    file = os.path.abspath(os.path.join(path, "./getJupyterVariableList.py"))
    if execute_script(file):
        read_out = capsys.readouterr()
        return json.loads(read_out.out)
    else:
        raise Exception("Getting variables failed.")


def find_variable_json(varList, varName):
    for sub in varList:
        if sub["name"] == varName:
            return sub


def get_variable_value(variables, name, capsys):
    varJson = find_variable_json(variables, name)
    path = os.path.dirname(os.path.abspath(__file__))
    file = os.path.abspath(os.path.join(path, "./getJupyterVariableValue.py"))
    keys = dict([("_VSCode_JupyterTestValue", json.dumps(varJson))])
    if execute_script(file, keys):
        read_out = capsys.readouterr()
        return json.loads(read_out.out)["value"]
    else:
        raise Exception("Getting variable value failed.")


def get_data_frame_info(variables, name, capsys):
    varJson = find_variable_json(variables, name)
    path = os.path.dirname(os.path.abspath(__file__))
    syspath = os.path.abspath(
        os.path.join(path, "../../vscode_datascience_helpers/dataframes")
    )
    syscode = 'import sys\nsys.path.append("{0}")'.format(syspath.replace("\\", "\\\\"))
    importcode = "import vscodeGetDataFrameInfo\nprint(vscodeGetDataFrameInfo._VSCODE_getDataFrameInfo({0}))".format(
        name
    )
    result = execute_code(syscode)
    if not result.success:
        result.raise_error()
    result = execute_code(importcode)
    if result.success:
        read_out = capsys.readouterr()
        info = json.loads(read_out.out[0:-1])
        varJson.update(info)
        return varJson
    else:
        result.raise_error()


def get_data_frame_rows(varJson, start, end, capsys):
    path = os.path.dirname(os.path.abspath(__file__))
    syspath = os.path.abspath(
        os.path.join(path, "../../vscode_datascience_helpers/dataframes")
    )
    syscode = 'import sys\nsys.path.append("{0}")'.format(syspath.replace("\\", "\\\\"))
    importcode = "import vscodeGetDataFrameRows\nprint(vscodeGetDataFrameRows._VSCODE_getDataFrameRows({0}, {1}, {2}))".format(
        varJson["name"], start, end
    )
    result = execute_code(syscode)
    if not result.success:
        result.raise_error()
    result = execute_code(importcode)
    if result.success:
        read_out = capsys.readouterr()
        return json.loads(read_out.out[0:-1])
    else:
        result.raise_error()
