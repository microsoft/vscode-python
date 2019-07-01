import { Event } from 'vscode';
import { Channel } from '../application/types';

export const IInsidersDownloadChannelRule = Symbol('IInsidersDownloadChannelRule');
export interface IInsidersDownloadChannelRule {
    buildToLookFor(didChannelChange?: boolean): Promise<Channel | undefined>;
}

export const IInsidersDownloadChannelService = Symbol('IInsidersDownloadChannelService');
export interface IInsidersDownloadChannelService {
    readonly onDidChannelChange: Event<InsidersBuildDownloadChannels>;
    getDownloadChannel(): InsidersBuildDownloadChannels;
    setDownloadChannel(value: InsidersBuildDownloadChannels): Promise<void>;
}

export const IInsidersPrompt = Symbol('IInsidersPrompt');
export interface IInsidersPrompt {
    notifyUser(): Promise<void>;
    promptToReload(): Promise<void>;
}

export enum InsidersBuildDownloadChannel {
    stable = 'Stable',
    weekly = 'InsidersWeekly',
    daily = 'InsidersDaily'
}
export type InsidersBuildDownloadChannels = 'Stable' | 'InsidersWeekly' | 'InsidersDaily';
