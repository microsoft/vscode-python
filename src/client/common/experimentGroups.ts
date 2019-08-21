export const LSControl = 'LS - control';
export const LSEnabled = 'LS - enabled';

// Experiment to check whether to always display the test explorer.
export enum AlwaysDisplayTestExplorerGroups {
    control = 'AlwaysDisplayTestExplorer - control',
    experiment = 'AlwaysDisplayTestExplorer - experiment'
}

// Experiment to check whether to show the "Run Python File in Terminal" icon.
export enum ShowPlayIcon {
    control = 'ShowPlayIcon - control',
    icon1 = 'ShowPlayIcon - start',
    icon2 = 'ShowPlayIcon - runFile'
}

// Experiment to check whether the ptvsd launcher should use pre-installed ptvsd wheels for debugging or not.
export enum DebugAdapterPtvsdGroups {
    control = 'DebugAdapterPtvsd - control',
    experiment = 'DebugAdapterPtvsd - experiment'
}
