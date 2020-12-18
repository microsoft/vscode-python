export enum TensorBoardPromptSelection {
    Yes = 'yes',
    No = 'no',
    DoNotAskAgain = 'doNotAskAgain',
}

export enum TensorBoardLaunchSource {
    tfeventfiles = 'tfeventfiles',
    codeaction = 'codeaction',
    codelens = 'codelens',
    fileimport = 'fileimport',
    terminal = 'terminal',
    nbextension = 'nbextension',
    palette = 'palette'
}

export enum TensorBoardSessionStartResult {
    cancel = 'canceled',
    success = 'success',
    error = 'error'
}

export enum TensorBoardEntryPoint {
    prompt = 'prompt',
    codeaction = 'codeaction',
    codelens = 'codelens'
}
