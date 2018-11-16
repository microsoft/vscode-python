// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { getOptions } from 'loader-utils';

// tslint:disable:no-default-export no-invalid-this
export type Options = {
    header: string;
};

export default function (source: string) {
    const options = getOptions(this) as Options;
    return (options.header || '') + source;
}
