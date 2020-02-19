// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { IDataScienceExtraSettings } from '../../client/datascience/types';

// From a set of data science settings build up any settings that need to be
// inserted into our StyleSetter divs
export function buildSettingsCss(settings: IDataScienceExtraSettings): string {
    return `#main-panel-content::-webkit-scrollbar {
    width: ${settings.extraSettings.verticalScrollbarSize}px;
}`;
}
