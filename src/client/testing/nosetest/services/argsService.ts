// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IServiceContainer } from '../../../ioc/types';
import { IArgumentsHelper, IArgumentsService, TestFilter } from '../../types';

const OptionsWithArguments = [
    '--attr',
    '--config',
    '--cover-html-dir',
    '--cover-min-percentage',
    '--cover-package',
    '--cover-xml-file',
    '--debug',
    '--debug-log',
    '--doctest-extension',
    '--doctest-fixtures',
    '--doctest-options',
    '--doctest-result-variable',
    '--eval-attr',
    '--exclude',
    '--id-file',
    '--ignore-files',
    '--include',
    '--log-config',
    '--logging-config',
    '--logging-datefmt',
    '--logging-filter',
    '--logging-format',
    '--logging-level',
    '--match',
    '--process-timeout',
    '--processes',
    '--py3where',
    '--testmatch',
    '--tests',
    '--verbosity',
    '--where',
    '--xunit-file',
    '--xunit-testsuite-name',
    '-A',
    '-a',
    '-c',
    '-e',
    '-i',
    '-I',
    '-l',
    '-m',
    '-w',
    '--profile-restrict',
    '--profile-sort',
    '--profile-stats-file',
];

const OptionsWithoutArguments = [
    '-h',
    '--help',
    '-V',
    '--version',
    '-p',
    '--plugins',
    '-v',
    '--verbose',
    '--quiet',
    '-x',
    '--stop',
    '-P',
    '--no-path-adjustment',
    '--exe',
    '--noexe',
    '--traverse-namespace',
    '--first-package-wins',
    '--first-pkg-wins',
    '--1st-pkg-wins',
    '--no-byte-compile',
    '-s',
    '--nocapture',
    '--nologcapture',
    '--logging-clear-handlers',
    '--with-coverage',
    '--cover-erase',
    '--cover-tests',
    '--cover-inclusive',
    '--cover-html',
    '--cover-branches',
    '--cover-xml',
    '--pdb',
    '--pdb-failures',
    '--pdb-errors',
    '--no-deprecated',
    '--with-doctest',
    '--doctest-tests',
    '--with-isolation',
    '-d',
    '--detailed-errors',
    '--failure-detail',
    '--no-skip',
    '--with-id',
    '--failed',
    '--process-restartworker',
    '--with-xunit',
    '--all-modules',
    '--collect-only',
    '--with-profile',
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
            withoutArgs: OptionsWithoutArguments,
        };
    }
    public getOptionValue(args: string[], option: string): string | string[] | undefined {
        return this.helper.getOptionValues(args, option);
    }
    // tslint:disable-next-line:max-func-body-length
    public filterArguments(args: string[], argumentToRemoveOrFilter: string[] | TestFilter): string[] {
        const optionsWithoutArgsToRemove: string[] = [];
        const optionsWithArgsToRemove: string[] = [];
        // Positional arguments in nosetest are test directories and files.
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
            switch (argumentToRemoveOrFilter) {
                case TestFilter.removeTests: {
                    removePositionalArgs = true;
                    break;
                }
                case TestFilter.discovery: {
                    optionsWithoutArgsToRemove.push(
                        ...[
                            '-v',
                            '--verbose',
                            '-q',
                            '--quiet',
                            '-x',
                            '--stop',
                            '--with-coverage',
                            ...OptionsWithoutArguments.filter((item) => item.startsWith('--cover')),
                            ...OptionsWithoutArguments.filter((item) => item.startsWith('--logging')),
                            ...OptionsWithoutArguments.filter((item) => item.startsWith('--pdb')),
                            ...OptionsWithoutArguments.filter((item) => item.indexOf('xunit') >= 0),
                        ]
                    );
                    optionsWithArgsToRemove.push(
                        ...[
                            '--verbosity',
                            '-l',
                            '--debug',
                            '--cover-package',
                            ...OptionsWithoutArguments.filter((item) => item.startsWith('--cover')),
                            ...OptionsWithArguments.filter((item) => item.startsWith('--logging')),
                            ...OptionsWithoutArguments.filter((item) => item.indexOf('xunit') >= 0),
                        ]
                    );
                    break;
                }
                case TestFilter.debugAll:
                case TestFilter.runAll: {
                    break;
                }
                case TestFilter.debugSpecific:
                case TestFilter.runSpecific: {
                    removePositionalArgs = true;
                    break;
                }
                default: {
                    throw new Error(`Unsupported Filter '${argumentToRemoveOrFilter}'`);
                }
            }
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
        return this.helper.getPositionalArguments(args, OptionsWithArguments, OptionsWithoutArguments);
    }
}
