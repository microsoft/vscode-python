// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

/*
This file is only used when using webpack for bundling.
We have a dummy file so that webpack doesn't fall over when trying to bundle pdfkit.
Just point it to a dummy file (this file).
Once webpack is done, we override the pdfkit.js file in the externalized node modules directory
with the actual source of pdfkit that needs to be used by nodejs (our extension code).
*/

class PDFDocument {}
module.exports = PDFDocument;
