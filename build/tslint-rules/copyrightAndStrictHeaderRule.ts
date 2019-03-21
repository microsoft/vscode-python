// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { EOL } from 'os';
import * as Lint from 'tslint';
import * as ts from 'typescript';
import { existingFiles, contributedFiles } from '../constants';
import { BaseRuleWalker } from './baseRuleWalker';

const ignoredFiles = [...existingFiles, ...contributedFiles];

const copyrightHeader = [
    '// Copyright (c) Microsoft Corporation. All rights reserved.',
    '// Licensed under the MIT License.',
    '',
    '\'use strict\';'
];
const copyrightHeaderNoSpace = [
    '// Copyright (c) Microsoft Corporation. All rights reserved.',
    '// Licensed under the MIT License.',
    '\'use strict\';'
];
const allowedCopyrightHeaders = [
    copyrightHeader.join('\n'), copyrightHeader.join('\r\n'),
    copyrightHeaderNoSpace.join('\n'), copyrightHeaderNoSpace.join('\r\n'),
    '\'use strict\';'
];
const failureMessage = 'Header must contain either \'use strict\' or [copyright] & \'use strict\' in the Python Extension files';

class NoFileWithoutCopyrightHeader extends BaseRuleWalker {
    public visitSourceFile(sourceFile: ts.SourceFile) {
        if (!this.shouldIgnoreCurrentFile(sourceFile)) {
            const sourceFileContents = sourceFile.getFullText();
            if (sourceFileContents) {
                this.validateHeader(sourceFile, sourceFileContents);
            }
        }

        super.visitSourceFile(sourceFile);
    }
    protected shouldIgnoreCurrentFile(node: ts.Node) {
        if (super.shouldIgnoreCurrentFile(node, ignoredFiles)) {
            return true;
        }
        return false;
    }
    private validateHeader(_sourceFile: ts.SourceFile, sourceFileContents: string) {
        for (const allowedHeader of allowedCopyrightHeaders) {
            if (sourceFileContents.startsWith(allowedHeader)) {
                return;
            }
        }

        const line1 = sourceFileContents.length > 0 ? sourceFileContents.split(/\r\n|\r|\n/)[0] : '';
        const fix = Lint.Replacement.appendText(0, `${copyrightHeader.join(EOL)}\n\n`);
        this.addFailure(this.createFailure(0, line1.length, failureMessage, fix));
    }
}

export class Rule extends Lint.Rules.AbstractRule {
    public static FAILURE_STRING = failureMessage;
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new NoFileWithoutCopyrightHeader(sourceFile, this.getOptions()));
    }
}
