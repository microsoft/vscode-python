// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import * as vscode from 'vscode';
import { IPlatformService } from '../platform/types';
import { ICurrentProcess, IPathUtils } from '../types';
import { OSType } from '../utils/platform';
import { IApplicationEnvironment } from './types';

@injectable()
export class ApplicationEnvironment implements IApplicationEnvironment {
    constructor(@inject(IPlatformService) private readonly platform: IPlatformService,
        @inject(IPathUtils) private readonly pathUtils: IPathUtils,
        @inject(ICurrentProcess) private readonly process: ICurrentProcess) { }

    public get userSettingsFile(): string | undefined {
        const vscodeFolderName = vscode.env.appName.indexOf('Insider') > 0 ? 'Code - Insiders' : 'Code';
        switch (this.platform.osType) {
            case OSType.OSX:
                return path.join(this.pathUtils.home, 'Library', 'Application Support', vscodeFolderName, 'User', 'settings.json');
            case OSType.Linux:
                return path.join(this.pathUtils.home, '.config', vscodeFolderName, 'User', 'settings.json');
            case OSType.Windows:
                return this.process.env.APPDATA ? path.join(this.process.env.APPDATA, vscodeFolderName, 'User', 'settings.json') : undefined;
            default:
                return;
        }
    }
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
    public get shell(): string | undefined {
        // tslint:disable-next-line:no-any
        return (vscode.env as any).shell;
    }
    // tslint:disable-next-line:no-any
    public get packageJson(): any {
        // tslint:disable-next-line:non-literal-require no-require-imports
        return require('../../../../package.json');
    }
}
