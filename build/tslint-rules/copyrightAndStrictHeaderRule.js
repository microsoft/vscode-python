// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const os_1 = require("os");
const Lint = require("tslint");
const constants_1 = require("../constants");
const baseRuleWalker_1 = require("./baseRuleWalker");
const ignoredFiles = [...constants_1.existingFiles, ...constants_1.contributedFiles];
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
class NoFileWithoutCopyrightHeader extends baseRuleWalker_1.BaseRuleWalker {
    visitSourceFile(sourceFile) {
        if (!this.shouldIgnoreCurrentFile(sourceFile)) {
            const sourceFileContents = sourceFile.getFullText();
            if (sourceFileContents) {
                this.validateHeader(sourceFile, sourceFileContents);
            }
        }
        super.visitSourceFile(sourceFile);
    }
    shouldIgnoreCurrentFile(node) {
        if (super.shouldIgnoreCurrentFile(node, ignoredFiles)) {
            return true;
        }
        return false;
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
