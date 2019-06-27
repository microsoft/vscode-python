import { Event } from 'vscode';

export const IInsidersDownloadChannelRule = Symbol('IInsidersDownloadChannelRule');
export interface IInsidersDownloadChannelRule {
    shouldLookForInsidersBuild(isChannelUsingDefaultConfiguration?: boolean): Promise<boolean>;
    shouldLookForStableBuild(isChannelUsingDefaultConfiguration?: boolean): Promise<boolean>;
}

export const IInsidersDownloadChannelService = Symbol('IInsidersDownloadChannelService');
export interface IInsidersDownloadChannelService {
    readonly onDidChannelChange: Event<InsidersBuildDownloadChannels>;
    readonly hasUserConfiguredChannel: boolean;
    getDownloadChannel(): InsidersBuildDownloadChannels;
    setDownloadChannel(value: InsidersBuildDownloadChannels, fireEvent?: boolean): Promise<void>;
}

export const IInsidersPrompt = Symbol('IInsidersPrompt');
export interface IInsidersPrompt {
    notifyUser(): Promise<void>;
}

export enum InsidersBuildDownloadChannel {
    stable = 'Stable',
    weekly = 'InsidersWeekly',
    daily = 'InsidersDaily'
}
export type InsidersBuildDownloadChannels = 'Stable' | 'InsidersWeekly' | 'InsidersDaily';
