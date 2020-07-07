// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as path from 'path';
import * as uuid from 'uuid/v4';
import { Uri } from 'vscode';
import '../../common/extensions';
import { Resource } from '../../common/types';
import * as localize from '../../common/utils/localize';

const UnknownIdentity = `6756fd82-b6dd-4117-81ec-aa38789eac86`;
export function getInteractiveIdentity(owner: Resource): Uri {
    return Uri.parse(`history:///${owner ? owner.path : UnknownIdentity}`);
}

export function createNewInteractiveIdentity(): Uri {
    return Uri.parse(`history:///${uuid()}`);
}

export function getInteractiveWindowTitle(owner: Uri): string {
    return localize.DataScience.interactiveWindowTitleFormat().format(path.basename(owner.fsPath));
}
