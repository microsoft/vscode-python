// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as fs from 'fs';
import * as path from 'path';
import * as Lint from 'tslint';
import * as ts from 'typescript';
import { ExtensionRootDir } from '../constants';

const copyrightHeader = [
    '// Copyright (c) Microsoft Corporation. All rights reserved.',
    '// Licensed under the MIT License.',
    '',
    '\'use strict\';'
];
const allowedCopyrightHeaders = [copyrightHeader.join('\n'), copyrightHeader.join('\r\n')];
const failureMessage = 'Header must contain copyright and \'use strict\' in the Python Extension';
const jsonFileWithListOfOldFiles = path.join(ExtensionRootDir, 'src', 'tools', 'existingFiles.json');
const filesNotToCheck: string[] = [];

function getListOfExcludedFiles() {
    if (filesNotToCheck.length === 0) {
        const files = JSON.parse(fs.readFileSync(jsonFileWithListOfOldFiles).toString()) as string[];
        files.forEach(file => filesNotToCheck.push(path.join(ExtensionRootDir, file)));
    }
    return filesNotToCheck;
}
class NoFileWithoutCopyrightHeader extends Lint.RuleWalker {
    private readonly filesToIgnore = getListOfExcludedFiles();
    public visitSourceFile(sourceFile: ts.SourceFile) {
        if (sourceFile && sourceFile.fileName && this.filesToIgnore.indexOf(sourceFile.fileName) === -1) {
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
