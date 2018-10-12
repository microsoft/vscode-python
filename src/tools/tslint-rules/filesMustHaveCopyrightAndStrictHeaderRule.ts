// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as Lint from 'tslint';
import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

const copyrightHeader = [
    '// Copyright (c) Microsoft Corporation. All rights reserved.',
    '// Licensed under the MIT License.',
    '',
    '\'use strict\';'
];
const allowedCopyrightHeaders = [copyrightHeader.join('\n'), copyrightHeader.join('\r\n')];
const failureMessage = 'Header must contain copyright and \'use strict\' in the Python Extension';
let filesNotToCheck = [];

function getListOfExcludedFiles() {
    if (filesNotToCheck.length === 0) {
        const jsonFileWithListOfOldFiles = path.join(__dirname, '..', '..', 'src', 'toos', 'existingFiles.json');
        filesNotToCheck = JSON.parse(fs.readFileSync(jsonFileWithListOfOldFiles).toString());
    }
    return filesNotToCheck;
}
class NoFileWithoutCopyrightHeader extends Lint.RuleWalker {
    public visitSourceFile(sourceFile: ts.SourceFile) {
        if (sourceFile && sourceFile.fileName) {
            const sourceFileContents = sourceFile.getFullText();
            if (sourceFileContents) {
                this.validateHeader(sourceFile, sourceFileContents);
            }
        }

        super.visitSourceFile(sourceFile);
    }
    private validateHeader(_sourceFile: ts.SourceFile, sourceFileContents: string) {
        for (const allowedHeader of allowedCopyrightHeaders) {
            if (sourceFileContents.startsWith(allowedHeader)) {
                return;
            }
        }

        const fix = new Lint.Replacement(0, 0, `${copyrightHeader}\n\n`);
        this.addFailure(this.createFailure(0, 1, failureMessage, fix));
    }
}

export class Rule extends Lint.Rules.AbstractRule {
    public static FAILURE_STRING = failureMessage;
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new NoFileWithoutCopyrightHeader(sourceFile, this.getOptions()));
    }
}
