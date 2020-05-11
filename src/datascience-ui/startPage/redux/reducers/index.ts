// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { StartPageMessages } from '../../../../client/datascience/startPage/types';
import { IStartPageActionMapping } from '../mapping';
import { Update } from './update';

// The list of reducers. 1 per message/action.
export const reducerMap: Partial<IStartPageActionMapping> = {
    // State updates
    [StartPageMessages.SendReleaseNotes]: Update.updateReleaseNotes,

    // Messages from the webview (some are ignored)
    [StartPageMessages.RequestReleaseNotes]: Update.updateReleaseNotes
};
