// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { SharedMessages } from '../../datascience/messages';

export const IStartPage = Symbol('IStartPage');
export interface IStartPage {
    open(): Promise<void>;
    extensionVersionChanged(): Promise<boolean>;
}

export interface ISettingPackage {
    showAgainSetting: boolean;
}

export namespace StartPageMessages {
    export const Started = SharedMessages.Started;
    export const UpdateSettings = SharedMessages.UpdateSettings;
    export const RequestShowAgainSetting = 'RequestShowAgainSetting';
    export const SendSetting = 'SendSetting';
    export const OpenBlankNotebook = 'OpenBlankNotebook';
    export const OpenBlankPythonFile = 'OpenBlankPythonFile';
    export const OpenInteractiveWindow = 'OpenInteractiveWindow';
    export const OpenCommandPalette = 'OpenCommandPalette';
    export const OpenCommandPaletteWithOpenNBSelected = 'OpenCommandPaletteWithOpenNBSelected';
    export const OpenSampleNotebook = 'OpenSampleNotebook';
    export const OpenFileBrowser = 'OpenFileBrowser';
    export const OpenFolder = 'OpenFolder';
    export const OpenWorkspace = 'OpenWorkspace';
}

export class IStartPageMapping {
    public [StartPageMessages.RequestShowAgainSetting]: ISettingPackage;
    public [StartPageMessages.SendSetting]: ISettingPackage;
    public [StartPageMessages.Started]: never | undefined;
    public [StartPageMessages.UpdateSettings]: boolean;
    public [StartPageMessages.OpenBlankNotebook]: never | undefined;
    public [StartPageMessages.OpenBlankPythonFile]: never | undefined;
    public [StartPageMessages.OpenInteractiveWindow]: never | undefined;
    public [StartPageMessages.OpenCommandPalette]: never | undefined;
    public [StartPageMessages.OpenCommandPaletteWithOpenNBSelected]: never | undefined;
    public [StartPageMessages.OpenSampleNotebook]: never | undefined;
    public [StartPageMessages.OpenFileBrowser]: never | undefined;
    public [StartPageMessages.OpenFolder]: never | undefined;
    public [StartPageMessages.OpenWorkspace]: never | undefined;
}
