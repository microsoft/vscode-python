// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { ConfigurationTarget, WorkspaceConfiguration } from 'vscode';

// tslint:disable: no-any
export class MockWorkspaceConfiguration implements WorkspaceConfiguration {
    private map: Map<string, any> = new Map<string, any>();

    // tslint:disable: no-any
    public get(key: string): any;
    public get<T>(section: string): T | undefined;
    public get<T>(section: string, defaultValue: T): T;
    public get(section: any, defaultValue?: any): any;
    public get(section: string, defaultValue?: any): any {
        if (this.map.has(section)) {
            return this.map.get(section);
        }
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
        section: string,
        value: any,
        _configurationTarget?: boolean | ConfigurationTarget | undefined
    ): Promise<void> {
        this.map.set(section, value);
        return Promise.resolve();
    }
}
