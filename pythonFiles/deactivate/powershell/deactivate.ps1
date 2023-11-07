# Same as deactivate in "Activate.ps1"
function global:deactivate ([switch]$NonDestructive) {
    if (Test-Path function:_OLD_VIRTUAL_PROMPT) {
        copy-item function:_OLD_VIRTUAL_PROMPT function:prompt
        remove-item function:_OLD_VIRTUAL_PROMPT
    }
    if (Test-Path env:_OLD_VIRTUAL_PYTHONHOME) {
        copy-item env:_OLD_VIRTUAL_PYTHONHOME env:PYTHONHOME
        remove-item env:_OLD_VIRTUAL_PYTHONHOME
    }
    if (Test-Path env:_OLD_VIRTUAL_PATH) {
        copy-item env:_OLD_VIRTUAL_PATH env:PATH
        remove-item env:_OLD_VIRTUAL_PATH
    }
    if (Test-Path env:VIRTUAL_ENV) {
        remove-item env:VIRTUAL_ENV
    }
    if (!$NonDestructive) {
        remove-item function:deactivate
    }
}

# Load JSON file
$jsonConfig = Get-Content -Raw -Path "$PSScriptRoot\envVars.json" | ConvertFrom-Json

# Check if PYTHONHOME exists in the JSON file and set it
if ($jsonConfig.PYTHONHOME) {
    copy-item env:PYTHONHOME env:_OLD_VIRTUAL_PYTHONHOME
    $env:PYTHONHOME = $jsonConfig.PYTHONHOME
}

# Check if PATH exists in the JSON file and set it
if ($jsonConfig.PATH) {
    copy-item env:PATH env:_OLD_VIRTUAL_PATH
    $env:PATH = $jsonConfig.PATH
}

