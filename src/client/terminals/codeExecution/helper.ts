// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import '../../common/extensions';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Range, TextEditor, Uri } from 'vscode';

import { IApplicationShell, IDocumentManager } from '../../common/application/types';
import { EXTENSION_ROOT_DIR, PYTHON_LANGUAGE } from '../../common/constants';
import { traceError } from '../../common/logger';
import { IProcessServiceFactory } from '../../common/process/types';
import { IInterpreterService } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { ICodeExecutionHelper } from '../types';

@injectable()
export class CodeExecutionHelper implements ICodeExecutionHelper {
    private readonly documentManager: IDocumentManager;
    private readonly applicationShell: IApplicationShell;
    private readonly processServiceFactory: IProcessServiceFactory;
    private readonly interpreterService: IInterpreterService;
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        this.documentManager = serviceContainer.get<IDocumentManager>(IDocumentManager);
        this.applicationShell = serviceContainer.get<IApplicationShell>(IApplicationShell);
        this.processServiceFactory = serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory);
        this.interpreterService = serviceContainer.get<IInterpreterService>(IInterpreterService);
    }
    public async normalizeLines(code: string, resource?: Uri): Promise<string> {
        try {
            if (code.trim().length === 0) {
                return '';
            }
            // On windows cr is not handled well by python when passing in/out via stdin/stdout.
            // So just remove cr from the input.
            code = code.replace(new RegExp('\\r', 'g'), '');
            const interpreter = await this.interpreterService.getActiveInterpreter(resource);
            const processService = await this.processServiceFactory.create(resource);
            const args = [path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'normalizeForInterpreter.py'), code];
            const proc = await processService.exec(interpreter?.path || 'python', args, { throwOnStdErr: true });

            return proc.stdout;
        } catch (ex) {
            traceError(ex, 'Python: Failed to normalize code for execution in terminal');
            return code;
        }
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
        if (activeEditor.document.languageId !== PYTHON_LANGUAGE) {
            this.applicationShell.showErrorMessage('The active file is not a Python source file');
            return;
        }
        if (activeEditor.document.isDirty) {
            await activeEditor.document.save();
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
    public async saveFileIfDirty(file: Uri): Promise<void> {
        const docs = this.documentManager.textDocuments.filter((d) => d.uri.path === file.path);
        if (docs.length === 1 && docs[0].isDirty) {
            await docs[0].save();
        }
    }
}
