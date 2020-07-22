// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { parse } from 'semver';
import * as vscode from 'vscode';
import { IPlatformService } from '../platform/types';
import { ICurrentProcess, IPathUtils } from '../types';
import { OSType } from '../utils/platform';
import { Channel, IApplicationEnvironment } from './types';

@injectable()
export class ApplicationEnvironment implements IApplicationEnvironment {
    constructor(
        @inject(IPlatformService) private readonly platform: IPlatformService,
        @inject(IPathUtils) private readonly pathUtils: IPathUtils,
        @inject(ICurrentProcess) private readonly process: ICurrentProcess
    ) {}

    public get userSettingsFile(): string | undefined {
        const vscodeFolderName = this.channel === 'insiders' ? 'Code - Insiders' : 'Code';
        switch (this.platform.osType) {
            case OSType.OSX:
                return path.join(
                    this.pathUtils.home,
                    'Library',
                    'Application Support',
                    vscodeFolderName,
                    'User',
                    'settings.json'
                );
            case OSType.Linux:
                return path.join(this.pathUtils.home, '.config', vscodeFolderName, 'User', 'settings.json');
            case OSType.Windows:
                return this.process.env.APPDATA
                    ? path.join(this.process.env.APPDATA, vscodeFolderName, 'User', 'settings.json')
                    : undefined;
            default:
                return;
        }
    }
    public get appName(): string {
        return vscode.env.appName;
    }
    public get vscodeVersion(): string {
        return vscode.version;
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
    /**
     * At the time of writing this API, the vscode.env.shell isn't officially released in stable version of VS Code.
     * Using this in stable version seems to throw errors in VSC with messages being displayed to the user about use of
     * unstable API.
     * Solution - log and suppress the errors.
     * @readonly
     * @type {(string)}
     * @memberof ApplicationEnvironment
     */
    public get shell(): string {
        return vscode.env.shell;
    }
    // tslint:disable-next-line:no-any
    public get packageJson(): any {
        // tslint:disable-next-line:non-literal-require no-require-imports
        return require('../../../../package.json');
    }
    public get channel(): Channel {
        return this.appName.indexOf('Insider') > 0 ? 'insiders' : 'stable';
    }
    public get extensionChannel(): Channel {
        const version = parse(this.packageJson.version);
        return !version || version.prerelease.length > 0 ? 'insiders' : 'stable';
    }
    public get uriScheme(): string {
        return vscode.env.uriScheme;
    }
}
