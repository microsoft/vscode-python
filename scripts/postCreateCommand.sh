#!/bin/bash
npm ci
# Create Virutal environment.
python3.7 -m venv /workspaces/vscode-python/.venv

# Activate Virtual environment.
source /workspaces/vscode-python/.venv/bin/activate

# Install required Python libraries.
npx gulp installPythonLibs

# Install testing requirement using python in .venv .
/workspaces/vscode-python/.venv/bin/python -m pip install -r build/test-requirements.txt
/workspaces/vscode-python/.venv/bin/python -m pip install -r build/smoke-test-requirements.txt
/workspaces/vscode-python/.venv/bin/python -m pip install -r build/functional-test-requirements.txt
