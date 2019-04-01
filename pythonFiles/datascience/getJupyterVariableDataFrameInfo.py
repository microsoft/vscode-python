# Query Jupyter server for the info about a dataframe
import json as _VSCODE_json

# In IJupyterVariables.getValue this '_VSCode_JupyterTestValue' will be replaced with the json stringified value of the target variable
# Indexes off of _VSCODE_targetVariable need to index types that are part of IJupyterVariable
_VSCODE_targetVariable = _VSCODE_json.loads('_VSCode_JupyterTestValue')
_VSCODE_evalResult = eval(_VSCODE_targetVariable['name'])

# First list out the columns of the data frame (assuming it is one for now)
_VSCODE_columnTypes = list(_VSCODE_evalResult.dtypes)
_VSCODE_columnNames = list(_VSCODE_evalResult)

# Make sure we have an index column (see code in getJupyterVariableDataFrameRows.py)
if 'index' not in _VSCODE_columnNames:
    _VSCODE_columnNames.insert(0, 'index')
    _VSCODE_columnTypes.insert(0, 'int64')

# Then loop and generate our output json
_VSCODE_columns = []
for n in range(0, len(_VSCODE_columnNames)):
    c = _VSCODE_columnNames[n]
    t = _VSCODE_columnTypes[n]
    _VSCODE_colobj = {}
    _VSCODE_colobj['key'] = c
    _VSCODE_colobj['name'] = c
    _VSCODE_colobj['type'] = str(t)
    _VSCODE_columns.append(_VSCODE_colobj)

del _VSCODE_columnNames
del _VSCODE_columnTypes

# Save this in our target
_VSCODE_targetVariable['columns'] = _VSCODE_columns
del _VSCODE_columns

# Figure out shape if not already there
if 'shape' not in _VSCODE_targetVariable:
    _VSCODE_targetVariable['shape'] = str(_VSCODE_evalResult.shape)

# Row count is actually embedded in shape. Should be the second number
import re as _VSCODE_re
_VSCODE_regex = r"\(\s*(\d+),\s*(\d+)\s*\)"
_VSCODE_matches = _VSCODE_re.search(_VSCODE_regex, _VSCODE_targetVariable['shape'])
if (_VSCODE_matches):
    _VSCODE_targetVariable['rowCount'] = int(_VSCODE_matches[1])
    del _VSCODE_matches
else:
    _VSCODE_targetVariable['rowCount'] = 0
del _VSCODE_regex

# Transform this back into a string
print(_VSCODE_json.dumps(_VSCODE_targetVariable))