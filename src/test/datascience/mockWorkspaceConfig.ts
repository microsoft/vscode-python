// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ConfigurationTarget, WorkspaceConfiguration } from 'vscode';

export class MockWorkspaceConfiguration implements WorkspaceConfiguration {
    // tslint:disable: no-any
    public get(key: string): any;
    public get<T>(section: string): T | undefined;
    public get<T>(section: string, defaultValue: T): T;
    public get(section: any, defaultValue?: any): any;
    public get(_: string, defaultValue?: any): any {
        return arguments.length > 1 ? defaultValue : (undefined as any);
    }
    public has(_section: string): boolean {
        return false;
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
        _section: string,
        _value: any,
        _configurationTarget?: boolean | ConfigurationTarget | undefined
    ): Promise<void> {
        return Promise.resolve();
    }
}
