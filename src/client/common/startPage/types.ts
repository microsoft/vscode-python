// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { SharedMessages } from '../../datascience/messages';

// Move to common/experiments/groups.ts when the VS Code webview bug is fixed
export enum EnableStartPage {
    control = 'EnableStartPage - control',
    experiment = 'EnableStartPage - experiment'
}

export const IStartPage = Symbol('IStartPage');
export interface IStartPage {
    open(): Promise<void>;
    handleReleaseNotesRequest(): Promise<string[]>;
    extensionVersionChanged(): Promise<boolean>;
}

export interface IReleaseNotesPackage {
    notes: string[];
    showAgainSetting: boolean;
}

export namespace StartPageMessages {
    export const Started = SharedMessages.Started;
    export const UpdateSettings = SharedMessages.UpdateSettings;
    export const RequestReleaseNotesAndShowAgainSetting = 'RequestReleaseNotesAndShowAgainSetting';
    export const SendReleaseNotes = 'SendReleaseNotes';
    export const OpenBlankNotebook = 'OpenBlankNotebook';
    export const OpenBlankPythonFile = 'OpenBlankPythonFile';
    export const OpenInteractiveWindow = 'OpenInteractiveWindow';
    export const OpenCommandPalette = 'OpenCommandPalette';
    export const OpenCommandPaletteWithOpenNBSelected = 'OpenCommandPaletteWithOpenNBSelected';
    export const OpenSampleNotebook = 'OpenSampleNotebook';
    export const OpenFileBrowser = 'OpenFileBrowser';
}

export class IStartPageMapping {
    public [StartPageMessages.RequestReleaseNotesAndShowAgainSetting]: IReleaseNotesPackage;
    public [StartPageMessages.SendReleaseNotes]: IReleaseNotesPackage;
    public [StartPageMessages.Started]: never | undefined;
    public [StartPageMessages.UpdateSettings]: boolean;
    public [StartPageMessages.OpenBlankNotebook]: never | undefined;
    public [StartPageMessages.OpenBlankPythonFile]: never | undefined;
    public [StartPageMessages.OpenInteractiveWindow]: never | undefined;
    public [StartPageMessages.OpenCommandPalette]: never | undefined;
    public [StartPageMessages.OpenCommandPaletteWithOpenNBSelected]: never | undefined;
    public [StartPageMessages.OpenSampleNotebook]: never | undefined;
    public [StartPageMessages.OpenFileBrowser]: never | undefined;
}
