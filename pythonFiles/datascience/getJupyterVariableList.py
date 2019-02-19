# Query Jupyter server for defined variables list
# Tested on 2.7 and 3.6
from sys import getsizeof
import json

localVars = %who_ls
varDic = []

for var in localVars:
    # Everything is assumed expensive when just loading the type list
    varDic.append({'name': var, 'type': type(eval(var)).__name__,
    'size': getsizeof(var), 'expensive': True})

json.dumps(varDic)