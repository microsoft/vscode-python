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

# Load dotenv-style file and set environment variables
Get-Content -Path "$PSScriptRoot\envVars.txt" | ForEach-Object {
    # Split each line into key and value at the first '='
    $parts = $_ -split '=', 2
    if ($parts.Count -eq 2) {
        $key = $parts[0].Trim()
        $value = $parts[1].Trim()
        # Set the environment variable
        Set-Item -Path "env:$key" -Value $value
    }
}
