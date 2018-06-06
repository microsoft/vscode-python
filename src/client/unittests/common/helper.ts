// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ILogger } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { IArgumentsHelper } from '../types';

@injectable()
export class ArgumentsHelper implements IArgumentsHelper {
    private readonly logger: ILogger;
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        this.logger = serviceContainer.get<ILogger>(ILogger);
    }
    public getOptionValues(args: string[], option: string): string | string[] | undefined {
        const values: string[] = [];
        let returnNextValue = false;
        for (const arg of args) {
            if (returnNextValue) {
                values.push(arg);
                returnNextValue = false;
                continue;
            }
            if (arg.startsWith(`${option}=`)) {
                values.push(arg.substring(`${option}=`.length));
                continue;
            }
            if (arg === option) {
                returnNextValue = true;
            }
        }
        switch (values.length) {
            case 0: {
                return;
            }
            case 1: {
                return values[0];
            }
            default: {
                return values;
            }
        }
    }
    public getPositionalArguments(args: string[], optionsWithArguments: string[] = [], optionsWithoutArguments: string[] = []): string[] {
        const filteredArgs = this.filterArguments(args, optionsWithArguments, optionsWithoutArguments);
        return filteredArgs.filter(arg => {
            // If we still have some args, then log them, and exlude them.
            if (arg.startsWith('-') || arg.indexOf('=') >= 0) {
                this.logger.logWarning(`Unknown command line option passed into PyTest '${arg}'. Please report on https://github.com/Microsoft/vscode-python/issues/new`);
                return false;
            }
            return true;
        });
    }
    public filterArguments(args: string[], optionsWithArguments: string[] = [], optionsWithoutArguments: string[] = []): string[] {
        let ignoreIndex = -1;
        return args.filter((arg, index) => {
            if (ignoreIndex === index) {
                return false;
            }
            // Options can use willd cards (with trailing '*')
            if (optionsWithoutArguments.indexOf(arg) >= 0 ||
                optionsWithoutArguments.filter(option => option.endsWith('*') && arg.startsWith(option.slice(0, -1))).length > 0) {
                return false;
            }
            // Ignore args that match exactly.
            if (optionsWithArguments.indexOf(arg) >= 0) {
                ignoreIndex = index + 1;
                return false;
            }
            // Ignore args that match exactly with wild cards & do not have inline values.
            if (optionsWithArguments.filter(option => arg.startsWith(`${option}=`)).length > 0) {
                return false;
            }
            // Ignore args that match a wild card (ending with *) and no ineline values.
            // Eg. arg='--log-cli-level' and optionsArguments=['--log-*']
            if (arg.indexOf('=') === -1 && optionsWithoutArguments.filter(option => option.endsWith('*') && arg.startsWith(option.slice(0, -1))).length > 0) {
                ignoreIndex = index + 1;
                return false;
            }
            // Ignore args that match a wild card (ending with *) and have ineline values.
            // Eg. arg='--log-cli-level=XYZ' and optionsArguments=['--log-*']
            if (arg.indexOf('=') >= 0 && optionsWithoutArguments.filter(option => option.endsWith('*') && arg.startsWith(option.slice(0, -1))).length > 0) {
                return false;
            }
            return true;
        });
    }
}
