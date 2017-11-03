/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/
export const CANCELLATION_REASON = 'cancelled_user_request';
export enum CommandSource {
    auto = 'auto',
    ui = 'ui',
    codelens = 'codelens',
    commandPalette = 'commandpalette'
}
