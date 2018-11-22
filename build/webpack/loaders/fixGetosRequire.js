// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:no-default-export no-invalid-this
function default_1(source) {
    const code = 'var logic = path.join(__dirname, \'logic/\' + name + \'.js\')';
    if (source.indexOf(code) === -1) {
        throw new Error('Code to replace not found in getos');
    }
    source = source.replace(code, 'var logic = \'./logic/\' + name + \'.js\'');
    return source;
}
exports.default = default_1;
