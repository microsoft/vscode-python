import {
    NotebookCellData,
    NotebookCellKind,
    NotebookDocument,
    NotebookEdit,
    TextEditor,
    workspace,
    WorkspaceEdit,
    Selection,
    Uri,
    commands,
    NotebookEditor,
    window,
} from 'vscode';
import { Commands } from '../common/constants';
import { noop } from '../common/utils/misc';
import { getActiveResource } from '../common/vscodeApis/windowApis';
import { getConfiguration } from '../common/vscodeApis/workspaceApis';
import { IInterpreterService } from '../interpreter/contracts';
import { PythonEnvironment } from '../pythonEnvironments/info';
import { getMultiLineSelectionText, getSingleLineSelectionText } from '../terminals/codeExecution/helper';
import { PythonServer } from './pythonServer';

/**
 * Function that returns selected text to execute in the REPL.
 * @param textEditor
 * @returns code - Code to execute in the REPL.
 */
export async function getSelectedTextToExecute(textEditor: TextEditor): Promise<string | undefined> {
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

/**
 * Function that returns user's Native REPL setting.
 * @returns boolean - True if sendToNativeREPL setting is enabled, False otherwise.
 */
export function getSendToNativeREPLSetting(): boolean {
    const uri = getActiveResource();
    const configuration = getConfiguration('python', uri);
    return configuration.get<boolean>('REPL.sendToNativeREPL', false);
}

/**
 * Function that adds cell to notebook.
 * This function will only get called when notebook document is defined.
 * @param code
 *
 */
export async function addCellToNotebook(notebookDocument: NotebookDocument, code: string): Promise<void> {
    const notebookCellData = new NotebookCellData(NotebookCellKind.Code, code as string, 'python');
    const { cellCount } = notebookDocument!;
    // Add new cell to interactive window document
    const notebookEdit = NotebookEdit.insertCells(cellCount, [notebookCellData]);
    const workspaceEdit = new WorkspaceEdit();
    workspaceEdit.set(notebookDocument!.uri, [notebookEdit]);
    await workspace.applyEdit(workspaceEdit);
}

/**
 * Function that checks if native REPL's text input box contains complete code.
 * @param activeEditor
 * @param pythonServer
 * @returns Promise<boolean> - True if complete/Valid code is present, False otherwise.
 */
export async function checkUserInputCompleteCode(
    activeEditor: TextEditor | undefined,
    pythonServer: PythonServer,
): Promise<boolean> {
    let completeCode = false;
    let userTextInput;
    if (activeEditor) {
        const { document } = activeEditor;
        userTextInput = document.getText();
    }

    // Check if userTextInput is a complete Python command
    if (userTextInput) {
        completeCode = await pythonServer.checkValidCommand(userTextInput);
    }

    return completeCode;
}

/**
 * Function that inserts new line in the given (input) text editor
 * @param activeEditor
 * @returns void
 */

export function insertNewLineToREPLInput(activeEditor: TextEditor | undefined): void {
    if (activeEditor) {
        const position = activeEditor.selection.active;
        const newPosition = position.with(position.line, activeEditor.document.lineAt(position.line).text.length);
        activeEditor.selection = new Selection(newPosition, newPosition);

        activeEditor.edit((editBuilder) => {
            editBuilder.insert(newPosition, '\n');
        });
    }
}

export function isMultiLineText(textEditor: TextEditor | undefined): boolean {
    return (textEditor?.document?.lineCount ?? 0) > 1;
}

/**
 * Function that trigger interpreter warning if invalid interpreter.
 * Function will also return undefined or active interpreter
 * @parm uri
 * @param interpreterService
 * @returns Promise<PythonEnvironment | undefined>
 */
export async function getActiveInterpreter(
    uri: Uri,
    interpreterService: IInterpreterService,
): Promise<PythonEnvironment | undefined> {
    const interpreter = await interpreterService.getActiveInterpreter(uri);
    if (!interpreter) {
        commands.executeCommand(Commands.TriggerEnvironmentSelection, uri).then(noop, noop);
        return undefined;
    }
    return interpreter;
}
/**
 * Function that will return any opened notebookEditor.
 * @returns NotebookEditor | undefined
 */
export function getNotebookEditor(): NotebookEditor | undefined {
    const temp = window.visibleNotebookEditors;
    return window.visibleNotebookEditors.find((editor) => editor !== undefined);
}

// get notebook editor given notebook document.
export function getNotebookEditor2(notebookDocument: NotebookDocument): NotebookEditor | undefined {
    return window.visibleNotebookEditors.find((editor) => editor.notebook === notebookDocument);
}
