// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const Lint = require("tslint");
const constants_1 = require("../constants");
class BaseRuleWalker extends Lint.RuleWalker {
    constructor() {
        super(...arguments);
        this.filesToIgnore = constants_1.filesNotToCheck;
    }
    sholdIgnoreCcurrentFile(node) {
        const sourceFile = node.getSourceFile();
        return sourceFile && sourceFile.fileName && this.filesToIgnore.indexOf(sourceFile.fileName.replace(/\//g, path.sep)) >= 0;
    }
}
exports.BaseRuleWalker = BaseRuleWalker;
