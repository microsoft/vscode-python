import os

# Use absolute path to avoid working directory issues
script_dir = os.path.dirname(os.path.abspath(__file__))
file_path = os.path.join(script_dir, 'smart_send_smoke.txt')

# For debugging: print working directory and file path
print(f"Working directory: {os.getcwd()}", flush=True)
print(f"File path: {file_path}", flush=True)
print(f"Script location: {os.path.abspath(__file__)}", flush=True)

with open(file_path, 'w') as f:
    f.write('This is for smart send smoke test')
    f.flush()  # Explicitly flush to ensure write completes

print(f"Successfully created {file_path}", flush=True)

print(f"About to delete {file_path}", flush=True)
os.remove(file_path)
print(f"Successfully deleted {file_path}", flush=True)
