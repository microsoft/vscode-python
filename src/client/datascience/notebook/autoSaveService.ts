// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

/**
 * When executing cells, VSCode doesn't perform a save operation.
 * However in Jupyter Lab (with auto save on), even when you execute cells auto save kicks in.
 * Solution:
 * - If notebook isn't saved after a cell is executed, then we can save manually.
 * - We need to take the auto save delay into account (if any, for throttling).
 * - Save only if user has executed (if execution count changes or cell output changes).
 * - When adding/deleting/editing cells, VSC automatically performs a save.
 *
 * Hence, we only need to handle auto save when executing cell.s
 */
// @injectable()
// export class AutoSaveService implements IExtensionSingleActivationService {}
