import { TextEditor } from 'vscode';
import { getActiveResource } from '../common/vscodeApis/windowApis';
import { getConfiguration } from '../common/vscodeApis/workspaceApis';
import { getMultiLineSelectionText, getSingleLineSelectionText } from '../terminals/codeExecution/helper';

export function getSendToNativeREPLSetting(): boolean {
    const uri = getActiveResource();
    const configuration = getConfiguration('python', uri);
    return configuration.get<boolean>('REPL.sendToNativeREPL', false);
}

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
