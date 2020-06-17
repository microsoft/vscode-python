// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { injectable } from 'inversify';
import { Uri } from 'vscode';

import { ILanguageServer, ILanguageServerCache } from '../../client/activation/types';
import { PythonInterpreter } from '../../client/pythonEnvironments/info';
import { MockLanguageServer } from './mockLanguageServer';

// tslint:disable:no-any unified-signatures
@injectable()
export class MockLanguageServerCache implements ILanguageServerCache {
    private mockLanguageServer = new MockLanguageServer();

    public get(_resource: Uri | undefined, _interpreter?: PythonInterpreter | undefined): Promise<ILanguageServer> {
        return Promise.resolve(this.mockLanguageServer);
    }

    public getMockServer(): MockLanguageServer {
        return this.mockLanguageServer;
    }
}
