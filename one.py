import re
import subprocess
import io

python_path = '/Users/donjayamanne/Desktop/Development/PythonStuff/IssueRepos/vscode-python-78/venv/bin/python'
out = subprocess.check_output([python_path, '-m', 'nose', '-h'])

def fix(items):
    items = list(item for item in items)
    return sorted(set(items), key=str.lower)

print("Short Options with arguments")
#This is the JS regex [^\S+](-{1}[a-zA-Z0-9]+) [^ ]+
items = re.findall('[^\S+](-{1}[a-zA-Z0-9]+) [^ ]+', str(out))
# print(len(items))
print(', '.join("'{}'".format(item) for item in fix(items)))

print("Short Options without arguments")
items = re.findall('[^\S+](-{1}[a-zA-Z0-9]+)(?:,|\s{2,})', str(out))
# print(len(items))
print(', '.join("'{}'".format(item) for item in fix(items)))

print("Long Options with arguments")
#This is the JS regex [^\S+](-{2}[a-zA-Z0-9-]+)=[^ ]+
items = re.findall('[^\S+](-{2}[a-zA-Z0-9-]+)=[^ ]+', str(out))
# print(len(items))
print(', '.join("'{}'".format(item) for item in fix(items)))

print("Long Options without arguments")
items = re.findall('[^\S+](-{2}[a-zA-Z0-9]+)(?:,|\s{2,})', str(out))
# print(len(items))
print(', '.join("'{}'".format(item) for item in fix(items)))
