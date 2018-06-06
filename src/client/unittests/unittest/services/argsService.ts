// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IServiceContainer } from '../../../ioc/types';
import { IArgumentsHelper, IArgumentsService, TestFilter } from '../../types';

const OptionsWithArguments = ['-p', '-s', '-t', '--pattern',
    '--start-directory', '--top-level-directory'];

const OptionsWithoutArgumentss = ['-b', '-c', '-f', '-q', '-v',
    '--buffer', '--catch', '--failfast', '--locals',
    '--quiet', '--verbose'];

@injectable()
export class ArgumentsService implements IArgumentsService {
    private readonly helper: IArgumentsHelper;
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        this.helper = serviceContainer.get<IArgumentsHelper>(IArgumentsHelper);
    }
    public getOptionValue(args: string[], option: string): string | string[] | undefined {
        return this.helper.getOptionValues(args, option);
    }
    public filterArguments(args: string[], argumentToRemoveOrFilter: string[] | TestFilter): string[] {
        const optionsWithoutArgsToRemove: string[] = [];
        const optionsWithArgsToRemove: string[] = [];
        // Positional arguments in pytest positional args are test directories and files.
        // So if we want to run a specific test, then remove positional args.
        let removePositionalArgs = false;
        if (Array.isArray(argumentToRemoveOrFilter)) {
            argumentToRemoveOrFilter.forEach(item => {
                if (OptionsWithArguments.indexOf(item) >= 0) {
                    optionsWithoutArgsToRemove.push(item);
                }
                if (OptionsWithoutArgumentss.indexOf(item) >= 0) {
                    optionsWithoutArgsToRemove.push(item);
                }
            });
        } else {
            switch (argumentToRemoveOrFilter) {
                case TestFilter.removeTests:
                case TestFilter.discovery: {
                    removePositionalArgs = true;
                    break;
                }
                case TestFilter.debugAll:
                case TestFilter.runAll:
                case TestFilter.debugSpecific:
                case TestFilter.runSpecific: {
                    optionsWithArgsToRemove.push(...[
                        '-s', '--start-directory',
                        '-t', '--top-level-directory',
                        '-p', '--pattern'
                    ]);
                    break;
                }
                default: {
                    throw new Error(`Unsupported Filter '${argumentToRemoveOrFilter}'`);
                }
            }
        }

        let filteredArgs = args.slice();
        if (removePositionalArgs) {
            const positionalArgs = this.helper.getPositionalArguments(filteredArgs, OptionsWithArguments, OptionsWithoutArgumentss);
            filteredArgs = filteredArgs.filter(item => positionalArgs.indexOf(item) === -1);
        }
        return this.helper.filterArguments(filteredArgs, optionsWithArgsToRemove, optionsWithoutArgsToRemove);
    }
    public getTestFolders(args: string[]): string[] {
        const shortValue = this.helper.getOptionValues(args, '-s');
        if (typeof shortValue === 'string') {
            return [shortValue];
        }
        const longValue = this.helper.getOptionValues(args, '--start-directory');
        if (typeof longValue === 'string') {
            return [longValue];
        }
        return ['.'];
    }
}
