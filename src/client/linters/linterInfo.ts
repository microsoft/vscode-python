// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { Uri } from 'vscode';
import { IWorkspaceService } from '../common/application/types';
import { ExecutionInfo, IConfigurationService, Product } from '../common/types';
import { ILinterInfo, LinterId } from './types';

// tslint:disable:no-any

export class LinterInfo implements ILinterInfo {
    private _id: LinterId;
    private _product: Product;
    private _configFileNames: string[];

    constructor(product: Product, id: LinterId, protected configService: IConfigurationService, configFileNames: string[] = []) {
        this._product = product;
        this._id = id;
        this._configFileNames = configFileNames;
    }

    public get id(): LinterId {
        return this._id;
    }
    public get product(): Product {
        return this._product;
    }

    public get pathSettingName(): string {
        return `${this.id}Path`;
    }
    public get argsSettingName(): string {
        return `${this.id}Args`;
    }
    public get enabledSettingName(): string {
        return `${this.id}Enabled`;
    }
    public get configFileNames(): string[] {
        return this._configFileNames;
    }

    public async enableAsync(enabled: boolean, resource?: Uri): Promise<void> {
        return this.configService.updateSetting(`linting.${this.enabledSettingName}`, enabled, resource);
    }
    public isEnabled(resource?: Uri): boolean {
        const settings = this.configService.getSettings(resource);
        return (settings.linting as any)[this.enabledSettingName] as boolean;
    }

    public pathName(resource?: Uri): string {
        const settings = this.configService.getSettings(resource);
        return (settings.linting as any)[this.pathSettingName] as string;
    }
    public linterArgs(resource?: Uri): string[] {
        const settings = this.configService.getSettings(resource);
        const args = (settings.linting as any)[this.argsSettingName];
        return Array.isArray(args) ? (args as string[]) : [];
    }
    public getExecutionInfo(customArgs: string[], resource?: Uri): ExecutionInfo {
        const execPath = this.pathName(resource);
        const args = this.linterArgs(resource).concat(customArgs);
        let moduleName: string | undefined;

        // If path information is not available, then treat it as a module,
        if (path.basename(execPath) === execPath) {
            moduleName = execPath;
        }

        return { execPath, moduleName, args, product: this.product };
    }
}

export class PylintLinterInfo extends LinterInfo {
    constructor(configService: IConfigurationService, private readonly workspaceService: IWorkspaceService, configFileNames: string[] = []) {
        super(Product.pylint, 'pylint', configService, configFileNames);
    }
    public isEnabled(resource?: Uri): boolean {
        const enabled = super.isEnabled(resource);
        if (!enabled || this.configService.getSettings(resource).jediEnabled) {
            return enabled;
        }
        // If we're using new LS, then by default Pylint is disabled (unless the user provides a value).
        const inspection = this.workspaceService.getConfiguration('python', resource).inspect<boolean>('linting.pylintEnabled');
        if (!inspection || (inspection.globalValue === undefined && inspection.workspaceFolderValue === undefined && inspection.workspaceValue === undefined)) {
            return false;
        }
        return enabled;
    }
}
