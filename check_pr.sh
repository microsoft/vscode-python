#!/bin/bash

# Function to run a command and check its status
run_command() {
    echo "Running: '$1'"
    echo "----------------------------------------"
    $1
    if [ $? -ne 0 ]; then
        echo "FAILURE: '$1'"
        exit 1
    else
        echo "----------------------------------------"
        echo "SUCCESS: '$1'"
        echo "----------------------------------------"
    fi
}

# Check dependencies
run_command "npm run checkDependencies"

# Run linter
run_command "npm run lint"

# Check formatting
run_command "npm run format-check"

# Activate the virtual environment
source ".venv/bin/activate"

# Change directory to python_files
cd python_files || exit

# Run Pyright
run_command "python -m pyright"

# Run Ruff
run_command "python -m ruff ."
echo "----------------------------------------"
echo "----------------------------------------"
echo "All checks passed successfully!"
