// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

/**
 * @typedef {Object} SplitLinesOptions
 * @property {boolean} [trim=true] - Whether to trim the lines.
 * @property {boolean} [removeEmptyEntries=true] - Whether to remove empty entries.
 */

// https://stackoverflow.com/questions/39877156/how-to-extend-string-prototype-and-use-it-next-in-typescript
// tslint:disable-next-line:interface-name
declare interface String {
    /**
     * Replaces characters such as 160 with 32.
     * When we get string content of html elements, we get char code 160 instead of 32.
     */
    normalize(): string;
    /**
     * String.format() implementation.
     * Tokens such as {0}, {1} will be replaced with corresponding positional arguments.
     */
    format(...args: string[]): string;
}
