// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable: no-invalid-this

import { Then } from 'cucumber';
import '../helpers/extensions';

type TextOrWordOrContent = 'text' | 'word' | 'message' | 'content';
Then('the {word} {string} will be displayed in the output panel', async function(_textOrMessage: TextOrWordOrContent, text: string) {
    await this.app.panels.waitUtilContent(text);
});

Then('the {word} {string} will be displayed in the output panel within {int} seconds', async function(_textOrMessage: TextOrWordOrContent, text: string, timeoutSeconds: number) {
    await this.app.panels.waitUtilContent(text, timeoutSeconds);
});
