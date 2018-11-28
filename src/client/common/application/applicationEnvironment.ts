// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable } from 'inversify';
import * as vscode from 'vscode';
import { IApplicationEnvironment } from './types';

@injectable()
export class ApplicationEnvironment implements IApplicationEnvironment {
    public get appName(): string {
        return vscode.env.appName;
    }
    public get appRoot(): string {
        return vscode.env.appRoot;
    }
    public get language(): string {
        return vscode.env.language;
    }
    public get sessionId(): string {
        return vscode.env.sessionId;
    }
    public get machineId(): string {
        return vscode.env.machineId;
    }
    public get extensionName(): string {
        // tslint:disable-next-line:non-literal-require
        return this.packageJson.displayName;
    }
    // tslint:disable-next-line:no-any
    public get packageJson(): any {
        // tslint:disable-next-line:non-literal-require no-require-imports
        return require('../../../../package.json');
    }
}
