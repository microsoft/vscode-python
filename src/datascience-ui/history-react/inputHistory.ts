// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

export class InputHistory {
    public completeUp() : string {
        return 'You pushed up';
    }

    public completeDown() : string {
        return 'You pushed down';
    }
}
