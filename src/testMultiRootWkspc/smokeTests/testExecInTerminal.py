import getopt
import sys
import os

optlist, args = getopt.getopt(sys.argv, '')

# If the caller has not specified the output file, create one for them with
# the same name as the caller script, but with a .log extension.
log_file = os.path.splitext(sys.argv[0])[0] + '.log'

# If the output file is given, use that instead.
if len(args) == 2:
    log_file = args[1]

# Ensure we use absolute path to avoid working directory issues
if not os.path.isabs(log_file):
    # Get the directory where this script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    log_file = os.path.join(script_dir, log_file)

# For debugging: print working directory and file path
print(f"Working directory: {os.getcwd()}", flush=True)
print(f"Log file path: {log_file}", flush=True)
print(f"Script location: {os.path.abspath(__file__)}", flush=True)

# Ensure parent directory exists
os.makedirs(os.path.dirname(log_file), exist_ok=True)

with open(log_file, "a") as f:
    f.write(sys.executable)
    f.flush()  # Explicitly flush to ensure write completes

print(f"Successfully wrote to {log_file}", flush=True)
