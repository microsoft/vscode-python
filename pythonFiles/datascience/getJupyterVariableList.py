# Query Jupyter server for defined variables list
# Tested on 2.7 and 3.6
from sys import getsizeof as _VSCODE_getsizeof
import json as _VSCODE_json

# who_ls is a Jupyter line magic to fetch currently defined vars
_VSCode_JupyterVars = %who_ls

print(_VSCODE_json.dumps([{'name': var,
                               'type': type(eval(var)).__name__,
                               'size': _VSCODE_getsizeof(var),
                               'expensive': True
                              } for var in _VSCode_JupyterVars]))

del _VSCode_JupyterVars
del _VSCODE_json
del _VSCODE_getsizeof
