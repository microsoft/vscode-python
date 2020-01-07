// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

const path = require('path');
const Lint = require('tslint');
const util = require('../util');
class BaseRuleWalker extends Lint.RuleWalker {
    shouldIgnoreCurrentFile(node, filesToIgnore) {
        const sourceFile = node.getSourceFile();
        if (sourceFile && sourceFile.fileName) {
            const filename = path.resolve(util.ExtensionRootDir, sourceFile.fileName);
            if (filesToIgnore.indexOf(filename.replace(/\//g, path.sep)) >= 0) {
                return true;
            }
        }
        return false;
    }
}
exports.BaseRuleWalker = BaseRuleWalker;
