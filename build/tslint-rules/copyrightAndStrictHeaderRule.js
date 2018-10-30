// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const os_1 = require("os");
const Lint = require("tslint");
const baseRuleWalker_1 = require("./baseRuleWalker");
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

const allowedCopyrightHeaders = [copyrightHeader.join('\n'), copyrightHeader.join('\r\n'), copyrightHeaderNoSpace.join('\n'), copyrightHeaderNoSpace.join('\r\n')];
const failureMessage = 'Header must contain copyright and \'use strict\' in the Python Extension';
class NoFileWithoutCopyrightHeader extends baseRuleWalker_1.BaseRuleWalker {
    visitSourceFile(sourceFile) {
        if (!this.sholdIgnoreCcurrentFile(sourceFile)) {
            const sourceFileContents = sourceFile.getFullText();
            if (sourceFileContents) {
                this.validateHeader(sourceFile, sourceFileContents);
            }
        }
        super.visitSourceFile(sourceFile);
    }
    validateHeader(_sourceFile, sourceFileContents) {
        for (const allowedHeader of allowedCopyrightHeaders) {
            if (sourceFileContents.startsWith(allowedHeader)) {
                return;
            }
        }
        const line1 = sourceFileContents.length > 0 ? sourceFileContents.split(/\r\n|\r|\n/)[0] : '';
        const fix = Lint.Replacement.appendText(0, `${copyrightHeader.join(os_1.EOL)}\n\n`);
        this.addFailure(this.createFailure(0, line1.length, failureMessage, fix));
    }
}
class Rule extends Lint.Rules.AbstractRule {
    apply(sourceFile) {
        return this.applyWithWalker(new NoFileWithoutCopyrightHeader(sourceFile, this.getOptions()));
    }
}
Rule.FAILURE_STRING = failureMessage;
exports.Rule = Rule;
