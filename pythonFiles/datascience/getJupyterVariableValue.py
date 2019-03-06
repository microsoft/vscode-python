import json
_VSCODE_max_len = 200
_VSCODE_targetVariable = json.loads('_VSCode_JupyterTestValue')

_VSCODE_evalResult = eval(_VSCODE_targetVariable['name'])

if _VSCODE_targetVariable['type'] in ['ndarray','DataFrame','Series']:
    _VSCODE_targetVariable['shape'] = str(_VSCODE_evalResult.shape)

if _VSCODE_targetVariable['type'] in ['tuple', 'str', 'dict', 'list', 'set', 'ndarray','DataFrame','Series']:
    _VSCODE_targetVariable['count'] = len(_VSCODE_evalResult)

_VSCODE_targetValue = str(_VSCODE_evalResult)
if len(_VSCODE_targetValue) > _VSCODE_max_len:
    _VSCODE_targetVariable['truncated'] = True
    _VSCODE_targetVariable['value'] = _VSCODE_targetValue[:_VSCODE_max_len]
else:
    _VSCODE_targetVariable['value'] = _VSCODE_targetValue

print(json.dumps(_VSCODE_targetVariable))