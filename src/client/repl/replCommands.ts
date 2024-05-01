import {
    commands,
    NotebookController,
    Uri,
    workspace,
    window,
    NotebookControllerAffinity,
    ViewColumn,
    NotebookEdit,
    NotebookCellData,
    NotebookCellKind,
    WorkspaceEdit,
    NotebookEditor,
    TextEditor,
} from 'vscode';
import { Disposable } from 'vscode-jsonrpc';
import { Commands, PVSC_EXTENSION_ID } from '../common/constants';
import { IInterpreterService } from '../interpreter/contracts';
import { getMultiLineSelectionText, getSingleLineSelectionText } from '../terminals/codeExecution/helper';
import { createReplController } from './replController';

let notebookController: NotebookController | undefined;
let notebookEditor: NotebookEditor | undefined;
let allNotebookEditors: [NotebookEditor] | undefined;
let mapUriToNotebookEditor: Map<Uri, NotebookEditor> | undefined;

// TODO: Need to figure out making separate REPL for each file:
// a.py in REPL.
// b.py run in REPL
// MAPPING Uri to notebookEditor if we want separate REPL for each file.
// Currently: Everything gets sent into one single REPL.

// TODO: when you reload window, is the REPL still binded to same Python file?
// cache binding uri to to REPL instance or notebookEditor.

// TODO: figure out way to put markdown telling user kernel has been dead and need to pick again.

// TODO: FIGURE OUT WHY INTELLISENSE IS NOT WORKING

async function getSelectedTextToExecute(textEditor: TextEditor): Promise<string | undefined> {
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

export async function registerReplCommands(
    disposables: Disposable[],
    interpreterService: IInterpreterService,
): Promise<void> {
    disposables.push(
        commands.registerCommand(Commands.Exec_In_REPL, async (uri: Uri) => {
            const interpreter = await interpreterService.getActiveInterpreter(uri);
            if (interpreter) {
                const interpreterPath = interpreter.path;
                // How do we get instance of interactive window from Python extension?
                if (!notebookController) {
                    notebookController = createReplController(interpreterPath);
                }
                const activeEditor = window.activeTextEditor as TextEditor;

                const code = await getSelectedTextToExecute(activeEditor);
                // const ourResource = Uri.from({ scheme: 'untitled', path: 'repl.interactive' });
                const ourResource2 = Uri.file(uri.path);

                // How to go from user clicking Run Python --> Run selection/line via Python REPL -> IW opening
                const notebookDocument = await workspace.openNotebookDocument(ourResource2);

                // We want to keep notebookEditor, whenever we want to run.
                // Find interactive window, or open it.

                // if (!notebookEditor) {
                //     notebookEditor = await window.showNotebookDocument(notebookDocument, {
                //         viewColumn: ViewColumn.Beside,
                //     });
                // }
                // Instead we need to first check if notebookEditor for given file Uri exist.
                // If it doesnt, we create notebookEditor and add to Map <Uri, NotebookEditor>
                if (!mapUriToNotebookEditor?.get(ourResource2) || !mapUriToNotebookEditor.get(ourResource2)) {
                    notebookEditor = await window.showNotebookDocument(notebookDocument, {
                        viewColumn: ViewColumn.Beside,
                    });
                    mapUriToNotebookEditor?.set(ourResource2, notebookEditor);
                }

                notebookController!.updateNotebookAffinity(notebookDocument, NotebookControllerAffinity.Default);

                // Auto-Select Python REPL Kernel
                await commands.executeCommand('notebook.selectKernel', {
                    notebookEditor,
                    id: notebookController?.id,
                    extension: PVSC_EXTENSION_ID,
                });

                const notebookCellData = new NotebookCellData(NotebookCellKind.Code, code as string, 'python');
                const { cellCount } = notebookDocument;
                // Add new cell to interactive window document
                const notebookEdit = NotebookEdit.insertCells(cellCount, [notebookCellData]);
                const workspaceEdit = new WorkspaceEdit();
                workspaceEdit.set(notebookDocument.uri, [notebookEdit]);
                workspace.applyEdit(workspaceEdit);

                // Execute the cell
                commands.executeCommand('notebook.cell.execute', {
                    ranges: [{ start: cellCount, end: cellCount + 1 }],
                    document: ourResource2,
                });
            }
        }),
    );
}
