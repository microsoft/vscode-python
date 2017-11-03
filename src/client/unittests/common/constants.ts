/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export const CANCELLATION_REASON = 'cancelled_user_request';
export enum CommandSource {
    auto = 'auto',
    ui = 'ui',
    codelens = 'codelens',
    commandPalette = 'commandpalette'
}
