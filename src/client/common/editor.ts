import {TextEdit, Position, Range, TextDocument, WorkspaceEdit} from 'vscode';
import * as vscode from 'vscode';
import * as dmp from 'diff-match-patch';
import {EOL} from 'os';
import * as fs from 'fs';
import * as path from 'path';
const tmp = require('tmp');

// Code borrowed from goFormat.ts (Go Extension for VS Code)
const EDIT_DELETE = 0;
const EDIT_INSERT = 1;
const EDIT_REPLACE = 2;
const NEW_LINE_LENGTH = EOL.length;

class Patch {
    diffs: dmp.Diff[];
    start1: number;
    start2: number;
    length1: number;
    length2: number;
}

class Edit {
    action: number;
    start: Position;
    end: Position;
    text: string;

    constructor(action: number, start: Position) {
        this.action = action;
        this.start = start;
        this.text = '';
    }

    apply(): TextEdit {
        switch (this.action) {
            case EDIT_INSERT:
                return TextEdit.insert(this.start, this.text);
            case EDIT_DELETE:
                return TextEdit.delete(new Range(this.start, this.end));
            case EDIT_REPLACE:
                return TextEdit.replace(new Range(this.start, this.end), this.text);
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

    let d = new dmp.diff_match_patch();
    let patches: any[] = patch_fromText.call(d, patch);
    if (!Array.isArray(patches) || patches.length === 0) {
        throw new Error('Unable to parse Patch string');
    }
    let textEdits: TextEdit[] = [];

    // Add line feeds
    // & build the text edits    
    patches.forEach(patch => {
        patch.diffs.forEach(diff => {
            diff[1] += EOL;
        });

        getTextEditsInternal(before, patch.diffs, patch.start1).forEach(edit => textEdits.push(edit.apply()));
    });

    return textEdits;
}
export function getWorkspaceEditsFromPatch(filePatches: string[], workspaceRoot?:string): WorkspaceEdit {
    const workspaceEdit = new WorkspaceEdit();
    filePatches.forEach(patch => {
        const indexOfAtAt = patch.indexOf('@@');
        if (indexOfAtAt === -1) {
            return;
        }
        const fileNameLines = patch.substring(0, indexOfAtAt).split(/\r?\n/g)
            .map(line => line.trim())
            .filter(line => line.length > 0 &&
                line.toLowerCase().endsWith('.py') &&
                line.indexOf(' a') > 0);

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
        if (!fs.existsSync(fileName)) {
            return;
        }

        // Remove the text added by unified_diff
        // # Work around missing newline (http://bugs.python.org/issue2142).
        patch = patch.replace(/\\ No newline at end of file[\r\n]/, '');

        let d = new dmp.diff_match_patch();
        let patches: any[] = patch_fromText.call(d, patch);
        if (!Array.isArray(patches) || patches.length === 0) {
            throw new Error('Unable to parse Patch string');
        }

        const fileSource = fs.readFileSync(fileName).toString('utf8');
        const fileUri = vscode.Uri.file(fileName);

        // Add line feeds
        // & build the text edits    
        patches.forEach(patch => {
            patch.diffs.forEach(diff => {
                diff[1] += EOL;
            });

            getTextEditsInternal(fileSource, patch.diffs, patch.start1).forEach(edit => {
                switch (edit.action) {
                    case EDIT_DELETE: {
                        workspaceEdit.delete(fileUri, new Range(edit.start, edit.end));
                    }
                    case EDIT_INSERT: {
                        workspaceEdit.insert(fileUri, edit.start, edit.text);
                    }
                    case EDIT_REPLACE: {
                        workspaceEdit.replace(fileUri, new Range(edit.start, edit.end), edit.text);
                    }
                }
            });
        });


    });

    return workspaceEdit;
}
export function getTextEdits(before: string, after: string): TextEdit[] {
    let d = new dmp.diff_match_patch();
    let diffs = d.diff_main(before, after);
    return getTextEditsInternal(before, diffs).map(edit => edit.apply());
}
function getTextEditsInternal(before: string, diffs: [number, string][], startLine: number = 0): Edit[] {
    let line = startLine;
    let character = 0;
    if (line > 0) {
        let beforeLines = <string[]>before.split(/\r?\n/g);
        beforeLines.filter((l, i) => i < line).forEach(l => character += l.length + NEW_LINE_LENGTH);
    }
    const edits: Edit[] = [];
    let edit: Edit = null;

    for (let i = 0; i < diffs.length; i++) {
        let start = new Position(line, character);

        // Compute the line/character after the diff is applied.
        for (let curr = 0; curr < diffs[i][1].length; curr++) {
            if (diffs[i][1][curr] !== '\n') {
                character++;
            } else {
                character = 0;
                line++;
            }
        }

        switch (diffs[i][0]) {
            case dmp.DIFF_DELETE:
                if (edit == null) {
                    edit = new Edit(EDIT_DELETE, start);
                } else if (edit.action !== EDIT_DELETE) {
                    throw new Error('cannot format due to an internal error.');
                }
                edit.end = new Position(line, character);
                break;

            case dmp.DIFF_INSERT:
                if (edit == null) {
                    edit = new Edit(EDIT_INSERT, start);
                } else if (edit.action === EDIT_DELETE) {
                    edit.action = EDIT_REPLACE;
                }
                // insert and replace edits are all relative to the original state
                // of the document, so inserts should reset the current line/character
                // position to the start.		
                line = start.line;
                character = start.character;
                edit.text += diffs[i][1];
                break;

            case dmp.DIFF_EQUAL:
                if (edit != null) {
                    edits.push(edit);
                    edit = null;
                }
                break;
        }
    }

    if (edit != null) {
        edits.push(edit);
    }

    return edits;
}

export function getTempFileWithDocumentContents(document: TextDocument): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        let ext = path.extname(document.uri.fsPath);
        let tmp = require('tmp');
        tmp.file({ postfix: ext }, function (err, tmpFilePath, fd) {
            if (err) {
                return reject(err);
            }
            fs.writeFile(tmpFilePath, document.getText(), ex => {
                if (ex) {
                    return reject(`Failed to create a temporary file, ${ex.message}`);
                }
                resolve(tmpFilePath);
            });
        });
    });
}


/**
 * Parse a textual representation of patches and return a list of Patch objects.
 * @param {string} textline Text representation of patches.
 * @return {!Array.<!diff_match_patch.patch_obj>} Array of Patch objects.
 * @throws {!Error} If invalid input.
 */
function patch_fromText(textline) {
    var patches = [];
    if (!textline) {
        return patches;
    }
    // Start Modification by Don Jayamanne 24/06/2016 Support for CRLF
    var text = textline.split(/[\r\n]/);
    // End Modification
    var textPointer = 0;
    var patchHeader = /^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@$/;
    while (textPointer < text.length) {
        var m = text[textPointer].match(patchHeader);
        if (!m) {
            throw new Error('Invalid patch string: ' + text[textPointer]);
        }
        var patch = new (<any>dmp.diff_match_patch).patch_obj();
        patches.push(patch);
        patch.start1 = parseInt(m[1], 10);
        if (m[2] === '') {
            patch.start1--;
            patch.length1 = 1;
        } else if (m[2] == '0') {
            patch.length1 = 0;
        } else {
            patch.start1--;
            patch.length1 = parseInt(m[2], 10);
        }

        patch.start2 = parseInt(m[3], 10);
        if (m[4] === '') {
            patch.start2--;
            patch.length2 = 1;
        } else if (m[4] == '0') {
            patch.length2 = 0;
        } else {
            patch.start2--;
            patch.length2 = parseInt(m[4], 10);
        }
        textPointer++;

        while (textPointer < text.length) {
            var sign = text[textPointer].charAt(0);
            try {
                //var line = decodeURI(text[textPointer].substring(1));
                // For some reason the patch generated by python files don't encode any characters
                // And this patch module (code from Google) is expecting the text to be encoded!!
                // Temporary solution, disable decoding
                // Issue #188
                var line = text[textPointer].substring(1);
            } catch (ex) {
                // Malformed URI sequence.
                throw new Error('Illegal escape in patch_fromText: ' + line);
            }
            if (sign == '-') {
                // Deletion.
                patch.diffs.push([dmp.DIFF_DELETE, line]);
            } else if (sign == '+') {
                // Insertion.
                patch.diffs.push([dmp.DIFF_INSERT, line]);
            } else if (sign == ' ') {
                // Minor equality.
                patch.diffs.push([dmp.DIFF_EQUAL, line]);
            } else if (sign == '@') {
                // Start of next patch.
                break;
            } else if (sign === '') {
                // Blank line?  Whatever.
            } else {
                // WTF?
                throw new Error('Invalid patch mode "' + sign + '" in: ' + line);
            }
            textPointer++;
        }
    }
    return patches;
}
