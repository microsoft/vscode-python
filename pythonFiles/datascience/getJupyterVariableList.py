# Query Jupyter server for defined variables list
# Tested on 2.7 and 3.6
from sys import getsizeof as _VSCODE_getsizeof
import json as _VSCODE_json
from IPython import get_ipython

# _VSCode_sub_supportsDataExplorer will contain our list of data explorer supported types
_VSCode_supportsDataExplorer = "['list', 'Series', 'dict', 'ndarray', 'DataFrame']"

# This code was copied from here:
_VSCode_JupyterVars = get_ipython().run_line_magic('who_ls', '')

_VSCode_output = []
for var in _VSCode_JupyterVars:
    try:
        _VSCode_type = type(eval(var))
        _VSCode_output.append({'name': var, 'type': _VSCode_type.__name__, 'size': _VSCODE_getsizeof(var), 'supportsDataExplorer': _VSCode_type.__name__ in _VSCode_supportsDataExplorer })
        del _VSCode_type
    except:
        pass

print(_VSCODE_json.dumps(_VSCode_output))

del _VSCode_output
del _VSCode_supportsDataExplorer
del _VSCode_JupyterVars
del _VSCODE_json
del _VSCODE_getsizeof
