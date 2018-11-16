// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const loader_utils_1 = require("loader-utils");
function default_1(source) {
    const options = loader_utils_1.getOptions(this);
    return (options.header || '') + source;
}
exports.default = default_1;
