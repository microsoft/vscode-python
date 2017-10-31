'use strict';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { PythonSettings } from '../common/configSettings';
import { getTempFileWithDocumentContents, getTextEditsFromPatch } from '../common/editor';

// tslint:disable-next-line:completed-docs
export class PythonImportSortProvider {
    public async sortImports(extensionDir: string, document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
        if (document.lineCount === 1) {
            return [];
        }
        // isort does have the ability to read from the process input stream and return the formatted code out of the output stream.
        // However they don't support returning the diff of the formatted text when reading data from the input stream.
        // Yes getting text formatted that way avoids having to create a temporary file, however the diffing will have
        // to be done here in node (extension), i.e. extension cpu, i.e. less responsive solution.
        const importScript = path.join(extensionDir, 'pythonFiles', 'sortImports.py');
        const tmpFileCreated = document.isDirty;
        const filePath = tmpFileCreated ? await getTempFileWithDocumentContents(document) : document.fileName;
        const settings = PythonSettings.getInstance(document.uri);
        const pythonPath = settings.pythonPath;
        const isort = settings.sortImports.path;
        const args = settings.sortImports.args.join(' ');
        let isortCmd = '';
        if (typeof isort === 'string' && isort.length > 0) {
            if (isort.indexOf(' ') > 0) {
                isortCmd = `"${isort}" "${filePath}" --diff ${args}`;
            } else {
                isortCmd = `${isort} "${filePath}" --diff ${args}`;
            }
        } else {
            if (pythonPath.indexOf(' ') > 0) {
                isortCmd = `"${pythonPath}" "${importScript}" "${filePath}" --diff ${args}`;
            } else {
                isortCmd = `${pythonPath} "${importScript}" "${filePath}" --diff ${args}`;
            }
        }
        // tslint:disable-next-line:promise-must-complete
        return await new Promise<vscode.TextEdit[]>((resolve, reject) => {
            child_process.exec(isortCmd, (error, stdout, stderr) => {
                if (tmpFileCreated) {
                    fs.unlink(filePath);
                }
                if (error || (stderr && stderr.length > 0)) {
                    reject(error ? error : stderr);
                } else {
                    resolve(getTextEditsFromPatch(document.getText(), stdout));
                }
            });
        });
    }
}
