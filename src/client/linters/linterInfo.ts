// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { Uri } from 'vscode';
import { LanguageServerType } from '../activation/types';
import { IWorkspaceService } from '../common/application/types';
import { ExecutionInfo, IConfigurationService, Product } from '../common/types';
import { ILinterInfo, LinterId } from './types';

// tslint:disable:no-any

export class LinterInfo implements ILinterInfo {
    private _id: LinterId;
    private _product: Product;
    private _configFileNames: string[];

    constructor(
        product: Product,
        id: LinterId,
        protected configService: IConfigurationService,
        configFileNames: string[] = [],
    ) {
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
    constructor(
        configService: IConfigurationService,
        private readonly workspaceService: IWorkspaceService,
        configFileNames: string[] = [],
    ) {
        super(Product.pylint, LinterId.PyLint, configService, configFileNames);
    }
    public isEnabled(resource?: Uri): boolean {
        // We want to be sure the setting is not default since default is `true` and hence
        // missing setting yields `true`. When setting is missing and LS is non-Jedi,
        // we want default to be `false`. So inspection here makes sure we are not getting
        // `true` because there is no setting and LS is active.
        const enabled = super.isEnabled(resource); // Is it enabled by settings?
        const usingJedi = this.configService.getSettings(resource).languageServer === LanguageServerType.Jedi;
        if (usingJedi) {
            // In Jedi case adhere to default behavior. Missing setting means `enabled`.
            return enabled;
        }
        // If we're using LS, then by default Pylint is disabled unless user provided
        // the value. We have to resort to direct inspection of settings here.
        const configuration = this.workspaceService.getConfiguration('python', resource);
        const inspection = configuration.inspect<boolean>(`linting.${this.enabledSettingName}`);
        if (
            !inspection ||
            (inspection.globalValue === undefined &&
                inspection.workspaceFolderValue === undefined &&
                inspection.workspaceValue === undefined)
        ) {
            return false;
        }
        return enabled;
    }
}
