#!/bin/bash

# Install pyenv and Python versions here to avoid using shim.
curl https://pyenv.run | bash
echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.bashrc
echo 'command -v pyenv >/dev/null || export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.bashrc
# echo 'eval "$(pyenv init -)"' >> ~/.bashrc

export PYENV_ROOT="$HOME/.pyenv"
command -v pyenv >/dev/null || export PATH="$PYENV_ROOT/bin:$PATH"
# eval "$(pyenv init -)" Comment this out and DO NOT use shim.
source ~/.bashrc

# Install Python via pyenv .
pyenv install 3.7:latest 3.8:latest 3.9:latest 3.10:latest 3.11:latest

# Set default Python version to 3.7 .
pyenv global 3.7.17

npm ci

# Create Virutal environment.
pyenv exec python3.7 -m venv .venv

# Activate Virtual environment.
source /workspaces/vscode-python/.venv/bin/activate

# Install required Python libraries.
npx gulp installPythonLibs

/workspaces/vscode-python/.venv/bin/python -m pip install -r build/test-requirements.txt
/workspaces/vscode-python/.venv/bin/python -m pip install -r build/smoke-test-requirements.txt
/workspaces/vscode-python/.venv/bin/python -m pip install -r build/functional-test-requirements.txt

# Below will crash codespace
# npm run compile
