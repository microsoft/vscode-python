export const IStartPage = Symbol('IStartPage');
export interface IStartPage {
    open(): Promise<void>;
}

export enum StartPageMessages {
    RequestReleaseNotes = 'RequestReleaseNotes',
    SendReleaseNotes = 'SendReleaseNotes',
    ReceivedReleaseNotes = 'ReceivedReleaseNotes'
}

export interface IReleaseNotesPackage {
    date: string;
    notes: string[];
}

export class IStartPageMapping {
    public [StartPageMessages.RequestReleaseNotes]: IReleaseNotesPackage;
    public [StartPageMessages.SendReleaseNotes]: IReleaseNotesPackage;
}
