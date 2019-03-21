// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import * as Lint from 'tslint';
import * as ts from 'typescript';
import { filesNotToCheck } from '../constants';

export class BaseRuleWalker extends Lint.RuleWalker {
    private readonly filesToIgnore = filesNotToCheck;
    protected shouldIgnoreCurrentFile(node: ts.Node): boolean {
        const sourceFile = node.getSourceFile();
        if (sourceFile && sourceFile.fileName) {
            if (this.filesToIgnore.indexOf(sourceFile.fileName.replace(/\//g, path.sep)) >= 0) {
                return true;
            }
        }
        return false;
    }
}
