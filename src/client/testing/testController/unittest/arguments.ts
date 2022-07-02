// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { TestFilter } from '../../common/types';
import { filterArguments, getOptionValues, getPositionalArguments } from '../common/argumentsHelper';

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
    '--verbose',
];

export function unittestFilterArguments(args: string[], argumentToRemoveOrFilter: string[] | TestFilter): string[] {
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
        const positionalArgs = getPositionalArguments(filteredArgs, OptionsWithArguments, OptionsWithoutArguments);
        filteredArgs = filteredArgs.filter((item) => positionalArgs.indexOf(item) === -1);
    }
    return filterArguments(filteredArgs, optionsWithArgsToRemove, optionsWithoutArgsToRemove);
}

export function unittestGetTestFolders(args: string[]): string[] {
    const shortValue = getOptionValues(args, '-s');
    if (shortValue.length === 1) {
        return shortValue;
    }
    const longValue = getOptionValues(args, '--start-directory');
    if (longValue.length === 1) {
        return longValue;
    }
    return ['.'];
}

export function unittestGetTestPattern(args: string[]): string {
    const shortValue = getOptionValues(args, '-p');
    if (shortValue.length === 1) {
        return shortValue[0];
    }
    const longValue = getOptionValues(args, '--pattern');
    if (longValue.length === 1) {
        return longValue[0];
    }
    return 'test*.py';
}

export function unittestGetTopLevelDirectory(args: string[]): string | null {
    const shortValue = getOptionValues(args, '-t');
    if (shortValue.length === 1) {
        return shortValue[0];
    }
    const longValue = getOptionValues(args, '--top-level-directory');
    if (longValue.length === 1) {
        return longValue[0];
    }
    return null;
}

export function getTestRunArgs(args: string[]): string[] {
    const startTestDiscoveryDirectory = unittestGetTestFolders(args)[0];
    const pattern = unittestGetTestPattern(args);
    const topLevelDir = unittestGetTopLevelDirectory(args);

    const failFast = args.some((arg) => arg.trim() === '-f' || arg.trim() === '--failfast');
    const verbosity = args.some((arg) => arg.trim().indexOf('-v') === 0) ? 2 : 1;
    const testArgs = [`--us=${startTestDiscoveryDirectory}`, `--up=${pattern}`, `--uvInt=${verbosity}`];
    if (topLevelDir) {
        testArgs.push(`--ut=${topLevelDir}`);
    }
    if (failFast) {
        testArgs.push('--uf');
    }
    return testArgs;
}
