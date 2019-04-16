# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
import re
from IPython import get_ipython
import os
import json

def execute_script(file: str, replace_dict: dict = dict([])):
    regex = re.compile('|'.join(replace_dict.keys())) if len(replace_dict.keys()) > 0 else None

    # Open the file. Read all lines into a string
    contents = ''
    with open(file, 'r') as fp:
        for line in fp:
            # Replace the key value pairs
            contents += line if regex == None else regex.sub(lambda m: replace_dict[m.group()], line)

    # Execute this script as a cell
    result = get_ipython().run_cell(contents)
    return result.success

def get_variables(capsys):
    path = os.path.dirname(os.path.abspath(__file__))
    file = os.path.abspath(os.path.join(path, '../../datascience/getJupyterVariableList.py'))
    if execute_script(file):
        read_out = capsys.readouterr()
        return json.loads(read_out.out)
    else:
        raise Exception('Printing variables failed.')

def find_variable_json(varList, varName: str):
    for sub in varList:
        if sub['name'] == varName:
            return sub

def get_variable_value(variables, name: str, capsys) -> str:
    varJson = find_variable_json(variables, name)
    path = os.path.dirname(os.path.abspath(__file__))
    file = os.path.abspath(os.path.join(path, '../../datascience/getJupyterVariableValue.py'))
    keys = dict([('_VSCode_JupyterTestValue', json.dumps(varJson))])
    if execute_script(file, keys):
        read_out = capsys.readouterr()
        return json.loads(read_out.out)['value']
    else:
        raise Exception('Printing variable value failed.')

def get_data_frame_info(variables, name, capsys):
    varJson = find_variable_json(variables, name)
    path = os.path.dirname(os.path.abspath(__file__))
    file = os.path.abspath(os.path.join(path, '../../datascience/getJupyterVariableDataFrameInfo.py'))
    keys = dict([('_VSCode_JupyterTestValue', json.dumps(varJson))])
    if execute_script(file, keys):
        read_out = capsys.readouterr()
        return json.loads(read_out.out)
    else:
        raise Exception('Printing variable value failed.')
