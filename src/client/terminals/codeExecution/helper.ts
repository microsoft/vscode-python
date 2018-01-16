// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { EOL } from 'os';
import { Range, TextEditor, Uri } from 'vscode';
import { IApplicationShell, IDocumentManager } from '../../common/application/types';
import { PythonLanguage } from '../../common/constants';
import '../../common/extensions';
import { ICodeExecutionHelper } from '../types';

@injectable()
export class CodeExecutionHelper implements ICodeExecutionHelper {
    constructor( @inject(IDocumentManager) private documentManager: IDocumentManager,
        @inject(IApplicationShell) private applicationShell: IApplicationShell) {

    }
    public normalizeLines(code: string): string {
        const codeLines = code.splitLines({ trim: false, removeEmptyEntries: false });
        const codeLinesWithoutEmptyLines = codeLines.filter(line => line.trim().length > 0);
        return codeLinesWithoutEmptyLines.join(EOL);
    }

    public async getFileToExecute(): Promise<Uri | undefined> {
        const activeEditor = this.documentManager.activeTextEditor!;
        if (!activeEditor) {
            this.applicationShell.showErrorMessage('No open file to run in terminal');
            return;
        }
        if (activeEditor.document.isUntitled) {
            this.applicationShell.showErrorMessage('The active file needs to be saved before it can be run');
            return;
        }
        if (activeEditor.document.languageId !== PythonLanguage.language) {
            this.applicationShell.showErrorMessage('The active file is not a Python source file');
            return;
        }
        return activeEditor.document.uri;
    }

    public async getSelectedTextToExecute(textEditor: TextEditor): Promise<string | undefined> {
        if (!textEditor) {
            return;
        }

        const selection = textEditor.selection;
        let code: string;
        if (selection.isEmpty) {
            code = textEditor.document.lineAt(selection.start.line).text;
        } else {
            const textRange = new Range(selection.start, selection.end);
            code = textEditor.document.getText(textRange);
        }
        return code;
    }
}
