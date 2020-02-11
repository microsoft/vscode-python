// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';
import * as localize from '../../common/utils/localize';

export class InvalidNotebookFileError extends Error {
    constructor(file?: string) {
        super(
            file
                ? localize.DataScience.invalidNotebookFileErrorFormat().format(file)
                : localize.DataScience.invalidNotebookFileError()
        );
    }
}
