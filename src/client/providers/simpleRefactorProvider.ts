import * as vscode from 'vscode';
import { Commands } from '../common/constants';
import { getTextEditsFromPatch } from '../common/editor';
import { traceError } from '../common/logger';
import { IPythonExecutionFactory } from '../common/process/types';
import { IInstaller, Product } from '../common/types';
import { StopWatch } from '../common/utils/stopWatch';
import { IServiceContainer } from '../ioc/types';
import { RefactorProxy } from '../refactor/proxy';
import { sendTelemetryWhenDone } from '../telemetry';
import { EventName } from '../telemetry/constants';

type RenameResponse = {
    results: [{ diff: string }];
};

let installer: IInstaller;

export function activateSimplePythonRefactorProvider(
    context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel,
    serviceContainer: IServiceContainer,
) {
    installer = serviceContainer.get<IInstaller>(IInstaller);
    let disposable = vscode.commands.registerCommand(Commands.Refactor_Extract_Variable, () => {
        const stopWatch = new StopWatch();
        const promise = extractVariable(
            vscode.window.activeTextEditor!,
            vscode.window.activeTextEditor!.selection,
            outputChannel,
            serviceContainer,
            // tslint:disable-next-line:no-empty
        ).catch(() => {});
        sendTelemetryWhenDone(EventName.REFACTOR_EXTRACT_VAR, promise, stopWatch);
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand(Commands.Refactor_Extract_Method, () => {
        const stopWatch = new StopWatch();
        const promise = extractMethod(
            vscode.window.activeTextEditor!,
            vscode.window.activeTextEditor!.selection,
            outputChannel,
            serviceContainer,
            // tslint:disable-next-line:no-empty
        ).catch(() => {});
        sendTelemetryWhenDone(EventName.REFACTOR_EXTRACT_FUNCTION, promise, stopWatch);
    });
    context.subscriptions.push(disposable);
}

// Exported for unit testing
export function extractVariable(
    textEditor: vscode.TextEditor,
    range: vscode.Range,
    outputChannel: vscode.OutputChannel,
    serviceContainer: IServiceContainer,
    // tslint:disable-next-line:no-any
): Promise<any> {
    let workspaceFolder = vscode.workspace.getWorkspaceFolder(textEditor.document.uri);
    if (
        !workspaceFolder &&
        Array.isArray(vscode.workspace.workspaceFolders) &&
        vscode.workspace.workspaceFolders.length > 0
    ) {
        workspaceFolder = vscode.workspace.workspaceFolders[0];
    }
    const workspaceRoot = workspaceFolder ? workspaceFolder.uri.fsPath : __dirname;

    return validateDocumentForRefactor(textEditor).then(() => {
        const newName = `newvariable${new Date().getMilliseconds().toString()}`;
        const proxy = new RefactorProxy(workspaceRoot, async () => {
            const factory = serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);
            return factory.create({ resource: vscode.Uri.file(workspaceRoot) });
        });
        const rename = proxy
            .extractVariable<RenameResponse>(
                textEditor.document,
                newName,
                textEditor.document.uri.fsPath,
                range,
                textEditor.options,
            )
            .then((response) => {
                return response.results[0].diff;
            });

        return extractName(textEditor, newName, rename, outputChannel);
    });
}

// Exported for unit testing
export function extractMethod(
    textEditor: vscode.TextEditor,
    range: vscode.Range,
    outputChannel: vscode.OutputChannel,
    serviceContainer: IServiceContainer,
    // tslint:disable-next-line:no-any
): Promise<any> {
    let workspaceFolder = vscode.workspace.getWorkspaceFolder(textEditor.document.uri);
    if (
        !workspaceFolder &&
        Array.isArray(vscode.workspace.workspaceFolders) &&
        vscode.workspace.workspaceFolders.length > 0
    ) {
        workspaceFolder = vscode.workspace.workspaceFolders[0];
    }
    const workspaceRoot = workspaceFolder ? workspaceFolder.uri.fsPath : __dirname;

    return validateDocumentForRefactor(textEditor).then(() => {
        const newName = `newmethod${new Date().getMilliseconds().toString()}`;
        const proxy = new RefactorProxy(workspaceRoot, async () => {
            const factory = serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);
            return factory.create({ resource: vscode.Uri.file(workspaceRoot) });
        });
        const rename = proxy
            .extractMethod<RenameResponse>(
                textEditor.document,
                newName,
                textEditor.document.uri.fsPath,
                range,
                textEditor.options,
            )
            .then((response) => {
                return response.results[0].diff;
            });

        return extractName(textEditor, newName, rename, outputChannel);
    });
}

// tslint:disable-next-line:no-any
function validateDocumentForRefactor(textEditor: vscode.TextEditor): Promise<any> {
    if (!textEditor.document.isDirty) {
        return Promise.resolve();
    }

    // tslint:disable-next-line:no-any
    return new Promise<any>((resolve, reject) => {
        vscode.window.showInformationMessage('Please save changes before refactoring', 'Save').then((item) => {
            if (item === 'Save') {
                textEditor.document.save().then(resolve, reject);
            } else {
                return reject();
            }
        });
    });
}

function extractName(
    textEditor: vscode.TextEditor,
    newName: string,
    renameResponse: Promise<string>,
    outputChannel: vscode.OutputChannel,
    // tslint:disable-next-line:no-any
): Promise<any> {
    let changeStartsAtLine = -1;
    return renameResponse
        .then((diff) => {
            if (diff.length === 0) {
                return [];
            }
            return getTextEditsFromPatch(textEditor.document.getText(), diff);
        })
        .then((edits) => {
            return textEditor.edit((editBuilder) => {
                edits.forEach((edit) => {
                    if (changeStartsAtLine === -1 || changeStartsAtLine > edit.range.start.line) {
                        changeStartsAtLine = edit.range.start.line;
                    }
                    editBuilder.replace(edit.range, edit.newText);
                });
            });
        })
        .then((done) => {
            if (done && changeStartsAtLine >= 0) {
                let newWordPosition: vscode.Position | undefined;
                for (let lineNumber = changeStartsAtLine; lineNumber < textEditor.document.lineCount; lineNumber += 1) {
                    const line = textEditor.document.lineAt(lineNumber);
                    const indexOfWord = line.text.indexOf(newName);
                    if (indexOfWord >= 0) {
                        newWordPosition = new vscode.Position(line.range.start.line, indexOfWord);
                        break;
                    }
                }

                if (newWordPosition) {
                    textEditor.selections = [
                        new vscode.Selection(
                            newWordPosition,
                            new vscode.Position(newWordPosition.line, newWordPosition.character + newName.length),
                        ),
                    ];
                    textEditor.revealRange(
                        new vscode.Range(textEditor.selection.start, textEditor.selection.end),
                        vscode.TextEditorRevealType.Default,
                    );
                }
                return newWordPosition;
            }
            return null;
        })
        .then((newWordPosition) => {
            if (newWordPosition) {
                return textEditor.document.save().then(() => {
                    // Now that we have selected the new variable, lets invoke the rename command
                    return vscode.commands.executeCommand('editor.action.rename');
                });
            }
        })
        .catch((error) => {
            if (error === 'Not installed') {
                installer
                    .promptToInstall(Product.rope, textEditor.document.uri)
                    .catch((ex) => traceError('Python Extension: simpleRefactorProvider.promptToInstall', ex));
                return Promise.reject('');
            }
            let errorMessage = `${error}`;
            if (typeof error === 'string') {
                errorMessage = error;
            }
            if (typeof error === 'object' && error.message) {
                errorMessage = error.message;
            }
            outputChannel.appendLine(`${'#'.repeat(10)}Refactor Output${'#'.repeat(10)}`);
            outputChannel.appendLine(`Error in refactoring:\n${errorMessage}`);
            vscode.window.showErrorMessage(`Cannot perform refactoring using selected element(s). (${errorMessage})`);
            return Promise.reject(error);
        });
}
