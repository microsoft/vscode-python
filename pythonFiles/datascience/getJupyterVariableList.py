# Query Jupyter server for defined variables list
# Tested on 2.7 and 3.6
from sys import getsizeof as _VSCODE_getsizeof
import json as _VSCODE_json

# _VSCode_sub_supportsDataExplorer will contain our list of data explorer supported types
_VSCode_supportsDataExplorer = _VSCode_sub_supportsDataExplorer

# who_ls is a Jupyter line magic to fetch currently defined vars
_VSCode_JupyterVars = %who_ls

print(_VSCODE_json.dumps([{'name': var,
                               'type': type(eval(var)).__name__,
                               'size': _VSCODE_getsizeof(var),
                               'supportsDataExplorer': type(eval(var)).__name__ in _VSCode_supportsDataExplorer,
                               'expensive': True
                              } for var in _VSCode_JupyterVars]))

del _VSCode_supportsDataExplorer
del _VSCode_JupyterVars
del _VSCODE_json
del _VSCODE_getsizeof
