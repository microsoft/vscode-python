// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

/**
 * Glob used to decide which saved files trigger test discovery.
 * A string is the legacy single-pattern form. An object maps each glob to a
 * boolean so VS Code can merge entries across settings scopes.
 */
export type AutoTestDiscoverOnSavePattern = string | { readonly [glob: string]: boolean };

export interface ITestingSettings {
    readonly promptToConfigure: boolean;
    readonly debugPort: number;
    readonly pytestEnabled: boolean;
    pytestPath: string;
    pytestArgs: string[];
    readonly unittestEnabled: boolean;
    unittestArgs: string[];
    cwd?: string;
    readonly autoTestDiscoverOnSaveEnabled: boolean;
    autoTestDiscoverOnSavePattern: AutoTestDiscoverOnSavePattern;
}

export type TestSettingsPropertyNames = {
    enabledName: keyof ITestingSettings;
    argsName: keyof ITestingSettings;
    pathName?: keyof ITestingSettings;
};
