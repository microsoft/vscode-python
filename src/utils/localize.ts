// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as nls from 'vscode-nls';

// Attempt to load from the vscode locale. If not there, use english
const vscodeConfigString = process.env.VSCODE_NLS_CONFIG;
let config: nls.Options = vscodeConfigString ? JSON.parse(vscodeConfigString) : { locale: 'en-us'};

// Try both bundles and files. Files make it work for this single file.
config.messageFormat = nls.MessageFormat.both;

const localize = nls.config(config)();

// Note:
// For every string you add here, it must be placed in the <root>/i18n/<lang>/out/utils/localize.i18n.json file as well.
// For every language we support. The fallback is placed in this file.
// Example:
// Source File:
// export const bannerMessage = localize('LanguageServiceSurveyBanner.bannerMessage', 'Hello');
// JSON File
// 'LanguageServiceSurveyBanner.bannerMessage': 'Hello'
//
// The gulp vscode:prepublish and gulp:i18n tasks will verify this is true.

export namespace LanguageServiceSurveyBanner {
    export const bannerMessage = localize('LanguageServiceSurveyBanner.bannerMessage', 'Can you please take 2 minutes to tell us how the Python Language Server is working for you?');
    export const bannerLabelYes = localize('LanguageServiceSurveyBanner.bannerLabelYes', 'Yes, take survey now');
    export const bannerLabelNo = localize('LanguageServiceSurveyBanner.bannerLabelNo', 'No, thanks');
}
