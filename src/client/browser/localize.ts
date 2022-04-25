// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

/* eslint-disable @typescript-eslint/no-namespace */

// IMPORTANT: Do not import any node fs related modules here, as they do not work in browser.
import * as nls from 'vscode-nls';

const localize: nls.LocalizeFunc = nls.loadMessageBundle();

export namespace LanguageService {
    export const statusItem = {
        name: localize('LanguageService.statusItem.name', 'Python IntelliSense Status'),
        text: localize('LanguageService.statusItem.text', 'Partial Mode'),
        detail: localize('LanguageService.statusItem.detail', 'Limited IntelliSense provided by Pylance'),
    };
}

export namespace Common {
    export const learnMore = localize('Common.learnMore', 'Learn more');
}
