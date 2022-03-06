// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { traceWarn } from '../../../logging';

export function getOptionValues(args: string[], option: string): string[] {
    const values: string[] = [];
    let returnNextValue = false;
    for (const arg of args) {
        if (returnNextValue) {
            values.push(arg);
            returnNextValue = false;
        } else if (arg.startsWith(`${option}=`)) {
            values.push(arg.substring(`${option}=`.length));
        } else if (arg === option) {
            returnNextValue = true;
        }
    }
    return values;
}

export function getPositionalArguments(
    args: string[],
    optionsWithArguments: string[] = [],
    optionsWithoutArguments: string[] = [],
): string[] {
    const nonPositionalIndexes: number[] = [];
    args.forEach((arg, index) => {
        if (optionsWithoutArguments.indexOf(arg) !== -1) {
            nonPositionalIndexes.push(index);
        } else if (optionsWithArguments.indexOf(arg) !== -1) {
            nonPositionalIndexes.push(index);
            // Cuz the next item is the value.
            nonPositionalIndexes.push(index + 1);
        } else if (optionsWithArguments.findIndex((item) => arg.startsWith(`${item}=`)) !== -1) {
            nonPositionalIndexes.push(index);
        } else if (arg.startsWith('-')) {
            // Ok this is an unknown option, lets treat this as one without values.
            traceWarn(
                `Unknown command line option passed into args parser for tests '${arg}'. Please report on https://github.com/Microsoft/vscode-python/issues/new`,
            );
            nonPositionalIndexes.push(index);
        } else if (arg.indexOf('=') > 0) {
            // Ok this is an unknown option with a value
            traceWarn(
                `Unknown command line option passed into args parser for tests '${arg}'. Please report on https://github.com/Microsoft/vscode-python/issues/new`,
            );
            nonPositionalIndexes.push(index);
        }
    });
    return args.filter((_, index) => nonPositionalIndexes.indexOf(index) === -1);
}

export function filterArguments(
    args: string[],
    optionsWithArguments: string[] = [],
    optionsWithoutArguments: string[] = [],
): string[] {
    let ignoreIndex = -1;
    return args.filter((arg, index) => {
        if (ignoreIndex === index) {
            return false;
        }
        // Options can use wild cards (with trailing '*')
        if (
            optionsWithoutArguments.indexOf(arg) >= 0 ||
            optionsWithoutArguments.filter((option) => option.endsWith('*') && arg.startsWith(option.slice(0, -1)))
                .length > 0
        ) {
            return false;
        }
        // Ignore args that match exactly.
        if (optionsWithArguments.indexOf(arg) >= 0) {
            ignoreIndex = index + 1;
            return false;
        }
        // Ignore args that match exactly with wild cards & do not have inline values.
        if (optionsWithArguments.filter((option) => arg.startsWith(`${option}=`)).length > 0) {
            return false;
        }
        // Ignore args that match a wild card (ending with *) and no inline values.
        // Eg. arg='--log-cli-level' and optionsArguments=['--log-*']
        if (
            arg.indexOf('=') === -1 &&
            optionsWithoutArguments.filter((option) => option.endsWith('*') && arg.startsWith(option.slice(0, -1)))
                .length > 0
        ) {
            ignoreIndex = index + 1;
            return false;
        }
        // Ignore args that match a wild card (ending with *) and have inline values.
        // Eg. arg='--log-cli-level=XYZ' and optionsArguments=['--log-*']
        if (
            arg.indexOf('=') >= 0 &&
            optionsWithoutArguments.filter((option) => option.endsWith('*') && arg.startsWith(option.slice(0, -1)))
                .length > 0
        ) {
            return false;
        }
        return true;
    });
}
