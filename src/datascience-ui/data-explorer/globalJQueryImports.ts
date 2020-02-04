// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

/*
This file exists for the sole purpose of ensuring jQuery and slickgrid load in the right sequence.
We need to first load jquery into window.jQuery.
After that we need to load slickgrid, and then the jQuery plugin from slickgrid event.drag.
*/

// Slickgrid requires jquery to be defined. Globally. So we do some hacks here.
// We need to manipulate the grid with the same jquery that it uses
// use slickgridJQ instead of the usual $ to make it clear that we need that JQ and not
// the one currently in node-modules

// tslint:disable-next-line: no-var-requires no-require-imports
require('expose-loader?jQuery!slickgrid/lib/jquery-1.11.2.min');

// tslint:disable-next-line: no-var-requires no-require-imports
require('slickgrid/lib/jquery-1.11.2.min');

// tslint:disable-next-line: no-var-requires no-require-imports
require('expose-loader?jQuery.fn.drag!slickgrid/lib/jquery.event.drag-2.3.0');
