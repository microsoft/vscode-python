// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { inject, injectable } from 'inversify';

import { ILanguageServer } from '../../activation/types';
import { IHistoryCompletionProvider } from '../types';
import { noop } from '../../common/utils/misc';
import { Uri } from 'vscode';

@injectable()
export class CompletionProvider implements IHistoryCompletionProvider {

    constructor(
        @inject(ILanguageServer) private languageServer: ILanguageServer
    ) {
        // Should have one of us per history 
    }

    public dispose() {
        noop();
    }

    public async startup(resource?: Uri) : Promise<void> {

    }

    public async provideCompletionItems() : Promise<CompletionItem[]> {

    }
    public async addCell(code: string): Promise<void> {

    }
    public async editCell(newCode: string, oldCode: string): void;


}
