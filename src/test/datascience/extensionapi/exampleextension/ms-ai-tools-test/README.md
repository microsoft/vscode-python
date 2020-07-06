# AI Tools Extension

This extension is used for testing the extensibility of the ms-python.python extension

# Testing with this extension

You can use this extension to test the python extension's API. To do so, follow these steps:

1. Create an azure compute node
1. Open .\src\serverPicker.ts
1. Change the code in serverPicker.ts to match your compute node
1. Switch to the directory that the README.md is in
1. Run npm install
1. Run npm run package
1. Install the VSIX created
1. Debug or run the ms-python.python package
1. Pick the 'Specify local or remote Jupyter server for connections'
1. This extension should then load and show the 'Azure Compute' entry in the picker that opens.
