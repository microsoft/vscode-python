// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { RemoteServerPickerExample } from './serverPicker';
import { IPythonExtensionApi } from './typings/python';

// Register our URI picker
export async function activate(_context: vscode.ExtensionContext) {
    const python = vscode.extensions.getExtension<IPythonExtensionApi>('ms-python.python');
    if (python) {
        if (!python.isActive) {
            await python.activate();
            await python.exports.ready;
        }
        python.exports.datascience.registerRemoteServerProvider(new RemoteServerPickerExample());
    }
}

// this method is called when your extension is deactivated
export function deactivate() {
    // Don't do anything at the moment here.
}
