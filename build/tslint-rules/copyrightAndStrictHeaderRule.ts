// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { EOL } from 'os';
import * as Lint from 'tslint';
import * as ts from 'typescript';
import { BaseRuleWalker } from './baseRuleWalker';

const copyrightHeader = [
    '// Copyright (c) Microsoft Corporation. All rights reserved.',
    '// Licensed under the MIT License.',
    '',
    '\'use strict\';'
];
const allowedCopyrightHeaders = [copyrightHeader.join('\n'), copyrightHeader.join('\r\n')];
const failureMessage = 'Header must contain copyright and \'use strict\' in the Python Extension';

class NoFileWithoutCopyrightHeader extends BaseRuleWalker {
    public visitSourceFile(sourceFile: ts.SourceFile) {
        if (!this.sholdIgnoreCcurrentFile(sourceFile)) {
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
