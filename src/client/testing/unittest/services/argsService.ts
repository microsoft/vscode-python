// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IServiceContainer } from '../../../ioc/types';
import { IArgumentsHelper, IArgumentsService, TestFilter } from '../../types';

const OptionsWithArguments = ['-k', '-p', '-s', '-t', '--pattern', '--start-directory', '--top-level-directory'];

const OptionsWithoutArguments = [
    '-b',
    '-c',
    '-f',
    '-h',
    '-q',
    '-v',
    '--buffer',
    '--catch',
    '--failfast',
    '--help',
    '--locals',
    '--quiet',
    '--verbose'
];

@injectable()
export class ArgumentsService implements IArgumentsService {
    private readonly helper: IArgumentsHelper;
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        this.helper = serviceContainer.get<IArgumentsHelper>(IArgumentsHelper);
    }
    public getKnownOptions(): { withArgs: string[]; withoutArgs: string[] } {
        return {
            withArgs: OptionsWithArguments,
            withoutArgs: OptionsWithoutArguments
        };
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
            argumentToRemoveOrFilter.forEach((item) => {
                if (OptionsWithArguments.indexOf(item) >= 0) {
                    optionsWithArgsToRemove.push(item);
                }
                if (OptionsWithoutArguments.indexOf(item) >= 0) {
                    optionsWithoutArgsToRemove.push(item);
                }
            });
        } else {
            removePositionalArgs = true;
        }

        let filteredArgs = args.slice();
        if (removePositionalArgs) {
            const positionalArgs = this.helper.getPositionalArguments(
                filteredArgs,
                OptionsWithArguments,
                OptionsWithoutArguments
            );
            filteredArgs = filteredArgs.filter((item) => positionalArgs.indexOf(item) === -1);
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
