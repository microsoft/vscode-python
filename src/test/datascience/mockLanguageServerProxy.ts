// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { injectable } from 'inversify';
import { Uri } from 'vscode';
import { LanguageClient, LanguageClientOptions } from 'vscode-languageclient';

import { ILanguageServerProxy } from '../../client/activation/types';
import { PythonInterpreter } from '../../client/pythonEnvironments/discovery/types';
import { MockLanguageClient } from './mockLanguageClient';

// tslint:disable:no-any unified-signatures
@injectable()
export class MockLanguageServerProxy implements ILanguageServerProxy {
    private mockLanguageClient: MockLanguageClient | undefined;

    public get languageClient(): LanguageClient | undefined {
        if (!this.mockLanguageClient) {
            this.mockLanguageClient = new MockLanguageClient('mockLanguageClient', { module: 'dummy' }, {});
        }
        return this.mockLanguageClient;
    }

    public start(
        _resource: Uri | undefined,
        _interpreter: PythonInterpreter | undefined,
        _options: LanguageClientOptions
    ): Promise<void> {
        if (!this.mockLanguageClient) {
            this.mockLanguageClient = new MockLanguageClient('mockLanguageClient', { module: 'dummy' }, {});
        }
        return Promise.resolve();
    }
    public loadExtension(_args?: {} | undefined): void {
        throw new Error('Method not implemented.');
    }
    public dispose(): void | undefined {
        this.mockLanguageClient = undefined;
    }
}
