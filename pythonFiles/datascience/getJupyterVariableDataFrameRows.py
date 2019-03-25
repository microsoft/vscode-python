# Query Jupyter server for the value of a variable
import json as _VSCODE_json

# In IJupyterVariables.getValue this '_VSCode_JupyterTestValue' will be replaced with the json stringified value of the target variable
# Indexes off of _VSCODE_targetVariable need to index types that are part of IJupyterVariable
_VSCODE_targetVariable = _VSCODE_json.loads('_VSCode_JupyterTestValue')
_VSCODE_evalResult = eval(_VSCODE_targetVariable['name'])

# _VSCode_JupyterStartRow and _VSCode_JupyterEndRow should be replaced dynamically with the literals
# for our start and end rows
_VSCODE_startRow = max(_VSCode_JupyterStartRow, 0)
_VSCODE_endRow = min(_VSCode_JupyterEndRow, _VSCODE_targetVariable['rowCount'])

# Extract our rows one at a time into separate json objects. This is 
# how the data grid expects them
_VSCODE_result = []
for n in range(_VSCODE_startRow, _VSCODE_endRow):
    _VSCODE_row = _VSCODE_json.loads(_VSCODE_evalResult.iloc[n].to_json())
    _VSCODE_row['index'] = n
    _VSCODE_result.append(_VSCODE_row)

# Transform this back into a string
print(_VSCODE_json.dumps(_VSCODE_result))

# Cleanup our variables
del _VSCODE_endRow
del _VSCODE_startRow
del _VSCODE_result