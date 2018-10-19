// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const Lint = require("tslint");
const constants_1 = require("../constants");
const copyrightHeader = [
    '// Copyright (c) Microsoft Corporation. All rights reserved.',
    '// Licensed under the MIT License.',
    '',
    '\'use strict\';'
];
const allowedCopyrightHeaders = [copyrightHeader.join('\n'), copyrightHeader.join('\r\n')];
const failureMessage = 'Header must contain copyright and \'use strict\' in the Python Extension';
class NoFileWithoutCopyrightHeader extends Lint.RuleWalker {
    constructor() {
        super(...arguments);
        this.filesToIgnore = constants_1.getListOfExcludedFiles();
    }
    visitSourceFile(sourceFile) {
        if (sourceFile && sourceFile.fileName && this.filesToIgnore.indexOf(sourceFile.fileName) === -1) {
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
        const fix = new Lint.Replacement(0, 0, `${copyrightHeader}\n\n`);
        this.addFailure(this.createFailure(0, 1, failureMessage, fix));
    }
}
class Rule extends Lint.Rules.AbstractRule {
    apply(sourceFile) {
        return this.applyWithWalker(new NoFileWithoutCopyrightHeader(sourceFile, this.getOptions()));
    }
}
Rule.FAILURE_STRING = failureMessage;
exports.Rule = Rule;
