import json
#_VSCode_JupyterVar = json.load('_VSCode_JupyterTestValue')
#_VSCode_JupyterVar['value'] = 'testvaluehere'
#print(json.dumps(_VSCode_JupyterVar))
#print(_VSCode_JupyterTestValue)
_VSCode_JupyterVar = '_VSCode_JupyterTestValue'
_VSCode_JupyterVar2 = json.loads(_VSCode_JupyterVar)
_VSCode_JupyterVar2['shortValue'] = 'testingtesting'
json.dumps(_VSCode_JupyterVar2)