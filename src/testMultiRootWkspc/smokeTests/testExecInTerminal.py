import sys
import os


log_file = os.path.splitext(sys.argv[0])[0] + '.log'
with open(log_file, "a") as f:
    f.write(sys.executable)
