// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-default-export no-invalid-this
export default function (source: string) {
    const code = 'var logic = path.join(__dirname, \'logic/\' + name + \'.js\')';
    if (source.indexOf(code) === -1) {
        throw new Error('Code to replace not found in getos');
    }
    source = source.replace(code, 'var logic = \'./logic/\' + name + \'.js\'');
    return source;
}
