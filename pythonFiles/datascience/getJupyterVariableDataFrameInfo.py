# Query Jupyter server for the info about a dataframe
import json as _VSCODE_json

# In IJupyterVariables.getValue this '_VSCode_JupyterTestValue' will be replaced with the json stringified value of the target variable
# Indexes off of _VSCODE_targetVariable need to index types that are part of IJupyterVariable
_VSCODE_targetVariable = _VSCODE_json.loads('_VSCode_JupyterTestValue')
_VSCODE_evalResult = eval(_VSCODE_targetVariable['name'])

# First list out the columns of the data frame (assuming it is one for now)
_VSCODE_columnTypes = []
_VSCODE_columnNames = []
if (hasattr(_VSCODE_evalResult, 'dtypes')):
    _VSCODE_columnTypes = list(_VSCODE_evalResult.dtypes)
    _VSCODE_columnNames = list(_VSCODE_evalResult)
elif _VSCODE_targetVariable['type'] == 'list':
    _VSCODE_columnTypes = ['string'] # Might be able to be more specific here?
    _VSCODE_columnNames = ['_VSCode_JupyterValuesColumn']

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

# Figure out shape if not already there. Use the shape to compute the row count
if (hasattr(_VSCODE_evalResult, "shape")):
    _VSCODE_targetVariable['rowCount'] = _VSCODE_evalResult.shape[0]
elif _VSCODE_targetVariable['type'] == 'list':
    _VSCODE_targetVariable['rowCount'] = len(_VSCODE_evalResult)
else:
    _VSCODE_targetVariable['rowCount'] = 0

# Transform this back into a string
print(_VSCODE_json.dumps(_VSCODE_targetVariable))