// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import * as Lint from 'tslint';
import * as ts from 'typescript';
import * as util from '../util';

export class BaseRuleWalker extends Lint.RuleWalker {
    protected shouldIgnoreCurrentFile(node: ts.Node, filesToIgnore: string[]): boolean {
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
