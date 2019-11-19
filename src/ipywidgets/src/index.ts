// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

export { WidgetManager } from './manager';
import * as base from '@jupyter-widgets/base';
import * as widgets from '@jupyter-widgets/controls';
import * as htmlManager from '@jupyter-widgets/html-manager';
import * as outputWidgets from '@jupyter-widgets/output';

// Export the following for `requirejs`.
// tslint:disable-next-line: no-any no-function-expression no-empty
const define = (window as any).define || function() {};
define('@jupyter-widgets/controls', () => widgets);
define('@jupyter-widgets/base', () => base);
define('@jupyter-widgets/output', () => outputWidgets);
define('@jupyter-widgets/html-manager', () => htmlManager);
