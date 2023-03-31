// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import '../../common/extensions';

import { inject, injectable } from 'inversify';
import { l10n, Position, Range, TextEditor, Uri } from 'vscode';

import { IApplicationShell, ICommandManager, IDocumentManager } from '../../common/application/types';
import { PYTHON_LANGUAGE } from '../../common/constants';
import * as internalScripts from '../../common/process/internal/scripts';
import { IProcessServiceFactory } from '../../common/process/types';
import { createDeferred } from '../../common/utils/async';
import { IInterpreterService } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { ICodeExecutionHelper } from '../types';
import { traceError } from '../../logging';
import { Resource } from '../../common/types';

@injectable()
export class CodeExecutionHelper implements ICodeExecutionHelper {
    private readonly documentManager: IDocumentManager;

    private readonly applicationShell: IApplicationShell;

    private readonly processServiceFactory: IProcessServiceFactory;

    private readonly interpreterService: IInterpreterService;

    constructor(@inject(IServiceContainer) private readonly serviceContainer: IServiceContainer) {
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

            const [args, parse] = internalScripts.normalizeSelection();
            const observable = processService.execObservable(interpreter?.path || 'python', args, {
                throwOnStdErr: true,
            });
            const normalizeOutput = createDeferred<string>();

            // Read result from the normalization script from stdout, and resolve the promise when done.
            let normalized = '';
            observable.out.subscribe({
                next: (output) => {
                    if (output.source === 'stdout') {
                        normalized += output.out;
                    }
                },
                complete: () => {
                    normalizeOutput.resolve(normalized);
                },
            });

            // The normalization script expects a serialized JSON object, with the selection under the "code" key.
            // We're using a JSON object so that we don't have to worry about encoding, or escaping non-ASCII characters.
            const input = JSON.stringify({ code });
            observable.proc?.stdin?.write(input);
            observable.proc?.stdin?.end();

            // We expect a serialized JSON object back, with the normalized code under the "normalized" key.
            const result = await normalizeOutput.promise;
            const object = JSON.parse(result);

            return parse(object.normalized);
        } catch (ex) {
            traceError(ex, 'Python: Failed to normalize code for execution in terminal');
            return code;
        }
    }

    public async getFileToExecute(): Promise<Uri | undefined> {
        const activeEditor = this.documentManager.activeTextEditor;
        if (!activeEditor) {
            this.applicationShell.showErrorMessage(l10n.t('No open file to run in terminal'));
            return undefined;
        }
        if (activeEditor.document.isUntitled) {
            this.applicationShell.showErrorMessage(l10n.t('The active file needs to be saved before it can be run'));
            return undefined;
        }
        if (activeEditor.document.languageId !== PYTHON_LANGUAGE) {
            this.applicationShell.showErrorMessage(l10n.t('The active file is not a Python source file)'));
            return undefined;
        }
        if (activeEditor.document.isDirty) {
            await activeEditor.document.save();
        }

        return activeEditor.document.uri;
    }

    // eslint-disable-next-line class-methods-use-this
    public async getSelectedTextToExecute(textEditor: TextEditor): Promise<string | undefined> {
        if (!textEditor) {
            return undefined;
        }

        const { selection } = textEditor;
        let code: string;
        if (selection.isEmpty) {
            code = textEditor.document.lineAt(selection.start.line).text;
        } else if (selection.isSingleLine) {
            code = getSingleLineSelectionText(textEditor);
        } else {
            code = getMultiLineSelectionText(textEditor);
        }
        return code;
    }

    public async saveFileIfDirty(file: Uri): Promise<Resource> {
        const docs = this.documentManager.textDocuments.filter((d) => d.uri.path === file.path);
        if (docs.length === 1 && docs[0].isDirty) {
            const deferred = createDeferred<Uri>();
            this.documentManager.onDidSaveTextDocument((e) => deferred.resolve(e.uri));
            const commandManager = this.serviceContainer.get<ICommandManager>(ICommandManager);
            await commandManager.executeCommand('workbench.action.files.save', file);
            const savedFileUri = await deferred.promise;
            return savedFileUri;
        }
        return undefined;
    }
}

function getSingleLineSelectionText(textEditor: TextEditor): string {
    const { selection } = textEditor;
    const selectionRange = new Range(selection.start, selection.end);
    const selectionText = textEditor.document.getText(selectionRange);
    const fullLineText = textEditor.document.lineAt(selection.start.line).text;

    if (selectionText.trim() === fullLineText.trim()) {
        // This handles the following case:
        // if (x):
        //     print(x)
        //     ↑------↑   <--- selection range
        //
        // We should return:
        //     print(x)
        // ↑----------↑    <--- text including the initial white space
        return fullLineText;
    }

    // This is where part of the line is selected:
    // if(isPrime(x) || isFibonacci(x)):
    //    ↑--------↑    <--- selection range
    //
    // We should return just the selection:
    // isPrime(x)
    return selectionText;
}

function getMultiLineSelectionText(textEditor: TextEditor): string {
    const { selection } = textEditor;
    const selectionRange = new Range(selection.start, selection.end);
    const selectionText = textEditor.document.getText(selectionRange);

    const fullTextRange = new Range(
        new Position(selection.start.line, 0),
        new Position(selection.end.line, textEditor.document.lineAt(selection.end.line).text.length),
    );
    const fullText = textEditor.document.getText(fullTextRange);

    // This handles case where:
    // def calc(m, n):
    //     ↓<------------------------------- selection start
    //     print(m)
    //     print(n)
    //            ↑<------------------------ selection end
    //     if (m == 0):
    //         return n + 1
    //     if (m > 0 and n == 0):
    //         return calc(m - 1 , 1)
    //     return calc(m - 1, calc(m, n - 1))
    //
    // We should return:
    // ↓<---------------------------------- From here
    //     print(m)
    //     print(n)
    //            ↑<----------------------- To here
    if (selectionText.trim() === fullText.trim()) {
        return fullText;
    }

    const fullStartLineText = textEditor.document.lineAt(selection.start.line).text;
    const selectionFirstLineRange = new Range(
        selection.start,
        new Position(selection.start.line, fullStartLineText.length),
    );
    const selectionFirstLineText = textEditor.document.getText(selectionFirstLineRange);

    // This handles case where:
    // def calc(m, n):
    //     ↓<------------------------------ selection start
    //     if (m == 0):
    //         return n + 1
    //                ↑<------------------- selection end (notice " + 1" is not selected)
    //     if (m > 0 and n == 0):
    //         return calc(m - 1 , 1)
    //     return calc(m - 1, calc(m, n - 1))
    //
    // We should return:
    // ↓<---------------------------------- From here
    //     if (m == 0):
    //         return n + 1
    //                ↑<------------------- To here (notice " + 1" is not selected)
    if (selectionFirstLineText.trimLeft() === fullStartLineText.trimLeft()) {
        return fullStartLineText + selectionText.substr(selectionFirstLineText.length);
    }

    // If you are here then user has selected partial start and partial end lines:
    // def calc(m, n):

    //     if (m == 0):
    //         return n + 1

    //        ↓<------------------------------- selection start
    //     if (m > 0
    //         and n == 0):
    //                   ↑<-------------------- selection end
    //         return calc(m - 1 , 1)
    //     return calc(m - 1, calc(m, n - 1))
    //
    // We should return:
    // ↓<---------------------------------- From here
    // (m > 0
    //         and n == 0)
    //                   ↑<---------------- To here
    return selectionText;
}
