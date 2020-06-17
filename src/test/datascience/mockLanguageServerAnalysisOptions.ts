// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { injectable } from 'inversify';
import { Event, EventEmitter } from 'vscode';
import { LanguageClientOptions } from 'vscode-languageclient/node';

import { ILanguageServerAnalysisOptions } from '../../client/activation/types';
import { Resource } from '../../client/common/types';
import { noop } from '../core';

// tslint:disable:no-any unified-signatures
@injectable()
export class MockLanguageServerAnalysisOptions implements ILanguageServerAnalysisOptions {
    private onDidChangeEmitter: EventEmitter<void> = new EventEmitter<void>();

    public get onDidChange(): Event<void> {
        return this.onDidChangeEmitter.event;
    }

    public initialize(_resource: Resource): Promise<void> {
        return Promise.resolve();
    }
    public getAnalysisOptions(): Promise<LanguageClientOptions> {
        return Promise.resolve({});
    }
    public dispose(): void | undefined {
        noop();
    }
}
