import getopt
import sys
import os

optlist, args = getopt.getopt(sys.argv, '')
if len(args) < 2:
    help_msg = '{} requires 1 parameter - the full path specification of the logfile to write.'.format(args[0])
    raise RuntimeError(help_msg)
    
log_file = args[1]

with open(log_file, "a") as f:
    f.write(sys.executable)
