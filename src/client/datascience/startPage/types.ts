export const IStartPage = Symbol('IStartPage');
export interface IStartPage {
    open(): Promise<void>;
}

export enum StartPageMessages {
    Open = 'StartPage_Open'
}

export class IStartPageMapping {
    public [StartPageMessages.Open]: string;
}
