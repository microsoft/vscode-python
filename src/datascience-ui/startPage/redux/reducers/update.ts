// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { IReleaseNotesPackage } from '../../../../client/datascience/startPage/types';
import { IStartPageProps } from '../../startPage';
import { StartPageReducerArg } from '../mapping';

export namespace Update {
    export function updateReleaseNotes(arg: StartPageReducerArg<IReleaseNotesPackage>): IStartPageProps {
        return {
            ...arg.prevState,
            releaseNotes: arg.payload.data
        };
    }
}
