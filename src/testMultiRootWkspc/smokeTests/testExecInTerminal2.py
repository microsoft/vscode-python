import sys
import os


log_file = os.path.splitext(sys.argv[0])[0] + '.log'
with open(log_file, "w") as outfile:
    outfile.write('Env Vars:\n')
    for k in os.environ.keys():
        outfile.write(f'{k}: {os.environ[k]}\n')

