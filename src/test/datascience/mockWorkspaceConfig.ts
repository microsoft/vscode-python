// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ConfigurationTarget, WorkspaceConfiguration } from 'vscode';

export class MockWorkspaceConfiguration implements WorkspaceConfiguration {
    // tslint:disable: no-any
    private values = new Map<string, any>();

    public get<T>(key: string, defaultValue?: T): T | undefined {
        // tslint:disable-next-line: use-named-parameter
        if (this.values.has(key)) {
            return this.values.get(key);
        }

        return arguments.length > 1 ? defaultValue : (undefined as any);
    }
    public has(section: string): boolean {
        return this.values.has(section);
    }
    public inspect<T>(
        _section: string
    ):
        | {
              key: string;
              defaultValue?: T | undefined;
              globalValue?: T | undefined;
              workspaceValue?: T | undefined;
              workspaceFolderValue?: T | undefined;
          }
        | undefined {
        return;
    }
    public update(
        section: string,
        value: any,
        _configurationTarget?: boolean | ConfigurationTarget | undefined
    ): Promise<void> {
        this.values.set(section, value);
        return Promise.resolve();
    }
}
