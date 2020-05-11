import { SharedMessages } from '../messages';

export const IStartPage = Symbol('IStartPage');
export interface IStartPage {
    open(): Promise<void>;
}

export namespace StartPageMessages {
    export const RequestReleaseNotes = 'RequestReleaseNotes';
    export const SendReleaseNotes = 'SendReleaseNotes';
    export const ReceivedReleaseNotes = 'ReceivedReleaseNotes';
    export const Started = SharedMessages.Started;
    export const UpdateSettings = SharedMessages.UpdateSettings;
}

export interface IReleaseNotesPackage {
    date: string;
    notes: string[];
}

export class IStartPageMapping {
    public [StartPageMessages.RequestReleaseNotes]: IReleaseNotesPackage;
    public [StartPageMessages.SendReleaseNotes]: IReleaseNotesPackage;
}
