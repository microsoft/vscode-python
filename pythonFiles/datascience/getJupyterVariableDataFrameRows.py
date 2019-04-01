# Query Jupyter server for the rows of a data frame
import json as _VSCODE_json
import pandas.io.json as _VSCODE_pd_json

# In IJupyterVariables.getValue this '_VSCode_JupyterTestValue' will be replaced with the json stringified value of the target variable
# Indexes off of _VSCODE_targetVariable need to index types that are part of IJupyterVariable
_VSCODE_targetVariable = _VSCODE_json.loads('_VSCode_JupyterTestValue')
_VSCODE_evalResult = eval(_VSCODE_targetVariable['name'])

# _VSCode_JupyterStartRow and _VSCode_JupyterEndRow should be replaced dynamically with the literals
# for our start and end rows
_VSCODE_startRow = max(_VSCode_JupyterStartRow, 0)
_VSCODE_endRow = min(_VSCode_JupyterEndRow, _VSCODE_targetVariable['rowCount'])

# Turn into JSON using pandas. We use pandas because it's about 3 orders of magnitude faster to turn into JSON
_VSCODE_rows = df.iloc[_VSCODE_startRow:_VSCODE_endRow]
_VSCODE_result = _VSCODE_pd_json.to_json(None, _VSCODE_rows, orient='table', date_format='iso')
print(_VSCODE_result)

# Cleanup our variables
del _VSCODE_endRow
del _VSCODE_startRow
del _VSCODE_rows
del _VSCODE_result