// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

/**
 * @typedef {Object} SplitLinesOptions
 * @property {boolean} [trim=true] - Whether to trim the lines.
 * @property {boolean} [removeEmptyEntries=true] - Whether to remove empty entries.
 */

// https://stackoverflow.com/questions/39877156/how-to-extend-string-prototype-and-use-it-next-in-typescript

declare interface String {
    /**
     * Split a string using the cr and lf characters and return them as an array.
     * By default lines are trimmed and empty lines are removed.
     * @param {SplitLinesOptions=} splitOptions - Options used for splitting the string.
     */
    splitLines(splitOptions?: { trim: boolean; removeEmptyEntries?: boolean }): string[];
    /**
     * Appropriately formats a string so it can be used as an argument for a command in a shell.
     * E.g. if an argument contains a space, then it will be enclosed within double quotes.
     */
    toCommandArgument(): string;
    /**
     * Appropriately formats a a file path so it can be used as an argument for a command in a shell.
     * E.g. if an argument contains a space, then it will be enclosed within double quotes.
     */
    fileToCommandArgument(): string;
    /**
     * String.format() implementation.
     * Tokens such as {0}, {1} will be replaced with corresponding positional arguments.
     */
    format(...args: string[]): string;

    /**
     * String.trimQuotes implementation
     * Removes leading and trailing quotes from a string
     */
    trimQuotes(): string;
}

declare interface Array<T> {
    /**
     * Returns the elements of an array that meet the condition specified in an async callback function.
     * @param asyncPredicate The filter method calls the async predicate function one time for each element in the array.
     */
    asyncFilter(asyncPredicate: (value: T) => Promise<unknown>): Promise<T[]>;
}

/**
 * Returns the elements of an array that meet the condition specified in an async callback function.
 * @param asyncPredicate The filter method calls the async predicate function one time for each element in the array.
 */
Array.prototype.asyncFilter = async function <T>(
    this: T[],
    asyncPredicate: (value: T) => Promise<unknown>,
): Promise<T[]> {
    const results = await Promise.all(this.map(asyncPredicate));
    return this.filter((_v, index) => results[index]);
};

/**
 * Split a string using the cr and lf characters and return them as an array.
 * By default lines are trimmed and empty lines are removed.
 * @param {SplitLinesOptions=} splitOptions - Options used for splitting the string.
 */
String.prototype.splitLines = function (
    this: string,
    splitOptions: { trim: boolean; removeEmptyEntries: boolean } = { removeEmptyEntries: true, trim: true },
): string[] {
    let lines = this.split(/\r?\n/g);
    if (splitOptions && splitOptions.trim) {
        lines = lines.map((line) => line.trim());
    }
    if (splitOptions && splitOptions.removeEmptyEntries) {
        lines = lines.filter((line) => line.length > 0);
    }
    return lines;
};

/**
 * Appropriately formats a string so it can be used as an argument for a command in a shell.
 * E.g. if an argument contains a space, then it will be enclosed within double quotes.
 * @param {String} value.
 */
String.prototype.toCommandArgument = function (this: string): string {
    if (!this) {
        return this;
    }
    return this.indexOf(' ') >= 0 && !this.startsWith('"') && !this.endsWith('"') ? `"${this}"` : this.toString();
};

/**
 * Appropriately formats a a file path so it can be used as an argument for a command in a shell.
 * E.g. if an argument contains a space, then it will be enclosed within double quotes.
 */
String.prototype.fileToCommandArgument = function (this: string): string {
    if (!this) {
        return this;
    }
    return this.toCommandArgument().replace(/\\/g, '/');
};

/**
 * String.trimQuotes implementation
 * Removes leading and trailing quotes from a string
 */
String.prototype.trimQuotes = function (this: string): string {
    if (!this) {
        return this;
    }
    return this.replace(/(^['"])|(['"]$)/g, '');
};

declare interface Promise<T> {
    /**
     * Catches task error and ignores them.
     */
    ignoreErrors(): void;
}

/**
 * Explicitly tells that promise should be run asynchonously.
 */
Promise.prototype.ignoreErrors = function <T>(this: Promise<T>) {
    this.catch(() => {});
};

if (!String.prototype.format) {
    String.prototype.format = function (this: string) {
        const args = arguments;
        return this.replace(/{(\d+)}/g, (match, number) => (args[number] === undefined ? match : args[number]));
    };
}
