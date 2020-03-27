// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { ExecutionInfo, IConfigurationService, IFormattingSettings, Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { FormatterId, FormatterSettingsPropertyNames, IFormatterHelper } from './types';

@injectable()
export class FormatterHelper implements IFormatterHelper {
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {}
    public translateToId(formatter: Product): FormatterId {
        switch (formatter) {
            case Product.autopep8:
                return 'autopep8';
            case Product.black:
                return 'black';
            case Product.yapf:
                return 'yapf';
            default: {
                throw new Error(`Unrecognized Formatter '${formatter}'`);
            }
        }
    }
    public getSettingsPropertyNames(formatter: Product): FormatterSettingsPropertyNames {
        const id = this.translateToId(formatter);
        return {
            argsName: `${id}Args` as keyof IFormattingSettings,
            pathName: `${id}Path` as keyof IFormattingSettings
        };
    }
    public getExecutionInfo(formatter: Product, customArgs: string[], resource?: Uri): ExecutionInfo {
        const settings = this.serviceContainer.get<IConfigurationService>(IConfigurationService).getSettings(resource);
        const names = this.getSettingsPropertyNames(formatter);

        const execPath = settings.formatting[names.pathName] as string;
        let args: string[] = Array.isArray(settings.formatting[names.argsName])
            ? (settings.formatting[names.argsName] as string[])
            : [];
        args = args.concat(customArgs);

        let moduleName: string | undefined;

        // If path information is not available, then treat it as a module,
        if (path.basename(execPath) === execPath) {
            moduleName = execPath;
        }

        return { execPath, moduleName, args, product: formatter };
    }
}
