// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

/* eslint-disable @typescript-eslint/no-namespace */

// IMPORTANT: Do not import any node fs related modules here, as they do not work in browser.
import { getLocalizedString } from '../common/utils/localizeHelpers';

export namespace LanguageService {
    export const statusItem = {
        name: localize('LanguageService.statusItem.name', 'Python IntelliSense Status'),
        text: localize('LanguageService.statusItem.text', 'Partial Mode'),
        detail: localize('LanguageService.statusItem.detail', 'Limited IntelliSense provided by Pylance'),
    };
}

function localize(key: string, defValue?: string) {
    // Return a pointer to function so that we refetch it on each call.
    return (): string => getLocalizedString(key, defValue);
}
