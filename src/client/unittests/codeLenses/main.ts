import * as vscode from 'vscode';
import { PYTHON } from '../../common/constants';
import { PythonSymbolProvider } from '../../providers/symbolProvider';
import { ITestCollectionStorageService } from '../common/types';
import { TestFileCodeLensProvider } from './testFiles';

export function activateCodeLenses(onDidChange: vscode.EventEmitter<void>,
    symboldProvider: PythonSymbolProvider, testCollectionStorage: ITestCollectionStorageService): vscode.Disposable {

    const disposables: vscode.Disposable[] = [];
    const codeLensProvider = new TestFileCodeLensProvider(onDidChange, symboldProvider, testCollectionStorage);
    disposables.push(vscode.languages.registerCodeLensProvider(PYTHON, codeLensProvider));

    return {
        dispose: () => { disposables.forEach(d => d.dispose()); }
    };
}
