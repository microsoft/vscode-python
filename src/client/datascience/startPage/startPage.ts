// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { injectable } from 'inversify';
import { Uri } from 'vscode';
import { Resource } from '../../common/types';
import { WebViewHost } from '../webViewHost';
import { IStartPage, IStartPageMapping } from './types';
// import * as path from 'path';

@injectable()
export class StartPage extends WebViewHost<IStartPageMapping> implements IStartPage {
    public get file(): Uri {
        return Uri.file('');
    }
    public async open(): Promise<void> {
        // open webview
        await super.show(true);
    }

    public async getOwningResource(): Promise<Resource> {
        return this.file;
    }
}
