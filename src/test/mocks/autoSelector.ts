// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable } from 'inversify';
import { Event, EventEmitter } from 'vscode';
import { Resource } from '../../client/common/types';
import {
    IInterpreterAutoSelectionService,
    IInterpreterAutoSeletionProxyService
} from '../../client/interpreter/autoSelection/types';
import { PythonInterpreter } from '../../client/interpreter/contracts';

@injectable()
export class MockAutoSelectionService
    implements IInterpreterAutoSelectionService, IInterpreterAutoSeletionProxyService {
    public async setWorkspaceInterpreter(_resource: Resource, _interpreter: PythonInterpreter): Promise<void> {
        return Promise.resolve();
    }
    public async setGlobalInterpreter(_interpreter: PythonInterpreter): Promise<void> {
        return;
    }
    get onDidChangeAutoSelectedInterpreter(): Event<void> {
        return new EventEmitter<void>().event;
    }
    public autoSelectInterpreter(_resource: Resource): Promise<void> {
        return Promise.resolve();
    }
    public getAutoSelectedInterpreter(_resource: Resource): PythonInterpreter | undefined {
        return;
    }
    public registerInstance(_instance: IInterpreterAutoSeletionProxyService): void {
        return;
    }
}
