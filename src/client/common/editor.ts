import { Diff, diff_match_patch } from 'diff-match-patch';
import { injectable } from 'inversify';
import * as md5 from 'md5';
import { EOL } from 'os';
import * as path from 'path';
import { Position, Range, TextDocument, TextEdit, Uri, WorkspaceEdit } from 'vscode';
import { IFileSystem } from '../common/platform/types';
import { traceError } from '../logging';
import { WrappedError } from './errors/errorUtils';
import { IEditorUtils } from './types';
import { isNotebookCell } from './utils/misc';

// Code borrowed from goFormat.ts (Go Extension for VS Code)
enum EditAction {
    Delete,
    Insert,
    Replace,
}

const NEW_LINE_LENGTH = EOL.length;

class Patch {
    public diffs!: Diff[];
    public start1!: number;
    public start2!: number;
    public length1!: number;
    public length2!: number;
}

class Edit {
    public action: EditAction;
    public start: Position;
    public end!: Position;
    public text: string;

    constructor(action: number, start: Position) {
        this.action = action;
        this.start = start;
        this.text = '';
    }

    public apply(): TextEdit {
        switch (this.action) {
            case EditAction.Insert:
                return TextEdit.insert(this.start, this.text);
            case EditAction.Delete:
                return TextEdit.delete(new Range(this.start, this.end));
            case EditAction.Replace:
                return TextEdit.replace(new Range(this.start, this.end), this.text);
            default:
                return new TextEdit(new Range(new Position(0, 0), new Position(0, 0)), '');
        }
    }
}

export function getTextEditsFromPatch(before: string, patch: string): TextEdit[] {
    if (patch.startsWith('---')) {
        // Strip the first two lines
        patch = patch.substring(patch.indexOf('@@'));
    }
    if (patch.length === 0) {
        return [];
    }
    // Remove the text added by unified_diff
    // # Work around missing newline (http://bugs.python.org/issue2142).
    patch = patch.replace(/\\ No newline at end of file[\r\n]/, '');

    const dmp = require('diff-match-patch') as typeof import('diff-match-patch');
    const d = new dmp.diff_match_patch();
    const patches = patch_fromText.call(d, patch);
    if (!Array.isArray(patches) || patches.length === 0) {
        throw new Error('Unable to parse Patch string');
    }
    const textEdits: TextEdit[] = [];

    // Add line feeds and build the text edits
    patches.forEach((p) => {
        p.diffs.forEach((diff) => {
            diff[1] += EOL;
        });
        getTextEditsInternal(before, p.diffs, p.start1).forEach((edit) => textEdits.push(edit.apply()));
    });

    return textEdits;
}
export function getWorkspaceEditsFromPatch(
    filePatches: string[],
    workspaceRoot: string | undefined,
    fs: IFileSystem,
): WorkspaceEdit {
    const workspaceEdit = new WorkspaceEdit();
    filePatches.forEach((patch) => {
        const indexOfAtAt = patch.indexOf('@@');
        if (indexOfAtAt === -1) {
            return;
        }
        const fileNameLines = patch
            .substring(0, indexOfAtAt)
            .split(/\r?\n/g)
            .map((line) => line.trim())
            .filter((line) => line.length > 0 && line.toLowerCase().endsWith('.py') && line.indexOf(' a') > 0);

        if (patch.startsWith('---')) {
            // Strip the first two lines
            patch = patch.substring(indexOfAtAt);
        }
        if (patch.length === 0) {
            return;
        }
        // We can't find the find name
        if (fileNameLines.length === 0) {
            return;
        }

        let fileName = fileNameLines[0].substring(fileNameLines[0].indexOf(' a') + 3).trim();
        fileName = workspaceRoot && !path.isAbsolute(fileName) ? path.resolve(workspaceRoot, fileName) : fileName;
        if (!fs.fileExistsSync(fileName)) {
            return;
        }

        // Remove the text added by unified_diff
        // # Work around missing newline (http://bugs.python.org/issue2142).
        patch = patch.replace(/\\ No newline at end of file[\r\n]/, '');

        const dmp = require('diff-match-patch') as typeof import('diff-match-patch');
        const d = new dmp.diff_match_patch();
        const patches = patch_fromText.call(d, patch);
        if (!Array.isArray(patches) || patches.length === 0) {
            throw new Error('Unable to parse Patch string');
        }

        const fileSource = fs.readFileSync(fileName);
        const fileUri = Uri.file(fileName);

        // Add line feeds and build the text edits
        patches.forEach((p) => {
            p.diffs.forEach((diff) => {
                diff[1] += EOL;
            });

            getTextEditsInternal(fileSource, p.diffs, p.start1).forEach((edit) => {
                switch (edit.action) {
                    case EditAction.Delete:
                        workspaceEdit.delete(fileUri, new Range(edit.start, edit.end));
                        break;
                    case EditAction.Insert:
                        workspaceEdit.insert(fileUri, edit.start, edit.text);
                        break;
                    case EditAction.Replace:
                        workspaceEdit.replace(fileUri, new Range(edit.start, edit.end), edit.text);
                        break;
                    default:
                        break;
                }
            });
        });
    });

    return workspaceEdit;
}

function getTextEditsInternal(before: string, diffs: [number, string][], startLine: number = 0): Edit[] {
    let line = startLine;
    let character = 0;
    const beforeLines = before.split(/\r?\n/g);
    if (line > 0) {
        beforeLines.filter((_l, i) => i < line).forEach((l) => (character += l.length + NEW_LINE_LENGTH));
    }
    const edits: Edit[] = [];
    let edit: Edit | null = null;
    let end: Position;

    for (let i = 0; i < diffs.length; i += 1) {
        let start = new Position(line, character);
        // Compute the line/character after the diff is applied.

        for (let curr = 0; curr < diffs[i][1].length; curr += 1) {
            if (diffs[i][1][curr] !== '\n') {
                character += 1;
            } else {
                character = 0;
                line += 1;
            }
        }

        const dmp = require('diff-match-patch') as typeof import('diff-match-patch');

        switch (diffs[i][0]) {
            case dmp.DIFF_DELETE:
                if (
                    beforeLines[line - 1].length === 0 &&
                    beforeLines[start.line - 1] &&
                    beforeLines[start.line - 1].length === 0
                ) {
                    // We're asked to delete an empty line which only contains `/\r?\n/g`. The last line is also empty.
                    // Delete the `\n` from the last line instead of deleting `\n` from the current line
                    // This change ensures that the last line in the file, which won't contain `\n` is deleted
                    start = new Position(start.line - 1, 0);
                    end = new Position(line - 1, 0);
                } else {
                    end = new Position(line, character);
                }
                if (edit === null) {
                    edit = new Edit(EditAction.Delete, start);
                } else if (edit.action !== EditAction.Delete) {
                    throw new Error('cannot format due to an internal error.');
                }
                edit.end = end;
                break;

            case dmp.DIFF_INSERT:
                if (edit === null) {
                    edit = new Edit(EditAction.Insert, start);
                } else if (edit.action === EditAction.Delete) {
                    edit.action = EditAction.Replace;
                }
                // insert and replace edits are all relative to the original state
                // of the document, so inserts should reset the current line/character
                // position to the start.
                line = start.line;
                character = start.character;
                edit.text += diffs[i][1];
                break;

            case dmp.DIFF_EQUAL:
                if (edit !== null) {
                    edits.push(edit);
                    edit = null;
                }
                break;
        }
    }

    if (edit !== null) {
        edits.push(edit);
    }

    return edits;
}

export async function getTempFileWithDocumentContents(document: TextDocument, fs: IFileSystem): Promise<string> {
    // Don't create file in temp folder since external utilities
    // look into configuration files in the workspace and are not
    // to find custom rules if file is saved in a random disk location.
    // This means temp file has to be created in the same folder
    // as the original one and then removed.
    // Use a .tmp file extension (instead of the original extension)
    // because the language server is watching the file system for Python
    // file add/delete/change and we don't want this temp file to trigger it.

    let fileName = `${document.uri.fsPath}.${md5(document.uri.fsPath + document.uri.fragment)}.tmp`;
    try {
        // When dealing with untitled notebooks, there's no original physical file, hence create a temp file.
        if (isNotebookCell(document.uri) && !(await fs.fileExists(document.uri.fsPath))) {
            fileName = (
                await fs.createTemporaryFile(`${path.basename(document.uri.fsPath)}-${document.uri.fragment}.tmp`)
            ).filePath;
        }
        await fs.writeFile(fileName, document.getText());
    } catch (ex) {
        traceError('Failed to create a temporary file', ex);
        const exception = ex as Error;
        throw new WrappedError(`Failed to create a temporary file, ${exception.message}`, exception);
    }
    return fileName;
}

/**
 * Parse a textual representation of patches and return a list of Patch objects.
 * @param {string} textline Text representation of patches.
 * @return {!Array.<!diff_match_patch.patch_obj>} Array of Patch objects.
 * @throws {!Error} If invalid input.
 */
function patch_fromText(textline: string): Patch[] {
    const patches: Patch[] = [];
    if (!textline) {
        return patches;
    }
    // Start Modification by Don Jayamanne 24/06/2016 Support for CRLF
    const text = textline.split(/[\r\n]/);
    // End Modification
    let textPointer = 0;
    const patchHeader = /^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@$/;
    while (textPointer < text.length) {
        const m = text[textPointer].match(patchHeader);
        if (!m) {
            throw new Error(`Invalid patch string: ${text[textPointer]}`);
        }

        const patch = new (<any>diff_match_patch).patch_obj();
        patches.push(patch);
        patch.start1 = parseInt(m[1], 10);
        if (m[2] === '') {
            patch.start1 -= 1;
            patch.length1 = 1;
        } else if (m[2] === '0') {
            patch.length1 = 0;
        } else {
            patch.start1 -= 1;
            patch.length1 = parseInt(m[2], 10);
        }

        patch.start2 = parseInt(m[3], 10);
        if (m[4] === '') {
            patch.start2 -= 1;
            patch.length2 = 1;
        } else if (m[4] === '0') {
            patch.length2 = 0;
        } else {
            patch.start2 -= 1;
            patch.length2 = parseInt(m[4], 10);
        }
        textPointer += 1;

        const dmp = require('diff-match-patch') as typeof import('diff-match-patch');

        while (textPointer < text.length) {
            const sign = text[textPointer].charAt(0);
            let line: string;
            try {
                //var line = decodeURI(text[textPointer].substring(1));
                // For some reason the patch generated by python files don't encode any characters
                // And this patch module (code from Google) is expecting the text to be encoded!!
                // Temporary solution, disable decoding
                // Issue #188
                line = text[textPointer].substring(1);
            } catch (ex) {
                // Malformed URI sequence.
                throw new Error('Illegal escape in patch_fromText');
            }
            if (sign === '-') {
                // Deletion.
                patch.diffs.push([dmp.DIFF_DELETE, line]);
            } else if (sign === '+') {
                // Insertion.
                patch.diffs.push([dmp.DIFF_INSERT, line]);
            } else if (sign === ' ') {
                // Minor equality.
                patch.diffs.push([dmp.DIFF_EQUAL, line]);
            } else if (sign === '@') {
                // Start of next patch.
                break;
            } else if (sign === '') {
                // Blank line?  Whatever.
            } else {
                throw new Error(`Invalid patch mode '${sign}' in: ${line}`);
            }
            textPointer += 1;
        }
    }
    return patches;
}

@injectable()
export class EditorUtils implements IEditorUtils {
    public getWorkspaceEditsFromPatch(originalContents: string, patch: string, uri: Uri): WorkspaceEdit {
        const workspaceEdit = new WorkspaceEdit();
        if (patch.startsWith('---')) {
            // Strip the first two lines
            patch = patch.substring(patch.indexOf('@@'));
        }
        if (patch.length === 0) {
            return workspaceEdit;
        }
        // Remove the text added by unified_diff
        // # Work around missing newline (http://bugs.python.org/issue2142).
        patch = patch.replace(/\\ No newline at end of file[\r\n]/, '');

        const dmp = require('diff-match-patch') as typeof import('diff-match-patch');
        const d = new dmp.diff_match_patch();
        const patches = patch_fromText.call(d, patch);
        if (!Array.isArray(patches) || patches.length === 0) {
            throw new Error('Unable to parse Patch string');
        }

        // Add line feeds and build the text edits
        patches.forEach((p) => {
            p.diffs.forEach((diff) => {
                diff[1] += EOL;
            });
            getTextEditsInternal(originalContents, p.diffs, p.start1).forEach((edit) => {
                switch (edit.action) {
                    case EditAction.Delete:
                        workspaceEdit.delete(uri, new Range(edit.start, edit.end));
                        break;
                    case EditAction.Insert:
                        workspaceEdit.insert(uri, edit.start, edit.text);
                        break;
                    case EditAction.Replace:
                        workspaceEdit.replace(uri, new Range(edit.start, edit.end), edit.text);
                        break;
                    default:
                        break;
                }
            });
        });

        return workspaceEdit;
    }
}
