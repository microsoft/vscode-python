# IANHU: Check for python 2.7 support
# Also load text once and reuse
from sys import getsizeof
import json

localVars = %who_ls
varDic = []

for var in localVars:
    # Everything is assumed expensive when just loading the type list
    varDic.append({'name': var, 'type': type(eval(var)).__name__,
    'size': getsizeof(var), 'expensive': 'true'})

json.dumps(varDic)