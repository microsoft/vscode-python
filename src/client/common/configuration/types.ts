import { Uri } from 'vscode';
import { IPythonSettings } from '../types';

export const IConfigurationService = Symbol('IConfigurationService');

export interface IConfigurationService {
    getSettings(resource?: Uri): IPythonSettings;
}
