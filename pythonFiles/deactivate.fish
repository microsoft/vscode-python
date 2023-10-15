# Same as deactivate in "<venv>/bin/activate.fish"
function deactivate  -d "Exit virtual environment and return to normal shell environment"
    # reset old environment variables
    if test -n "$_OLD_VIRTUAL_PATH"
        set -gx PATH $_OLD_VIRTUAL_PATH
        set -e _OLD_VIRTUAL_PATH
    end
    if test -n "$_OLD_VIRTUAL_PYTHONHOME"
        set -gx PYTHONHOME $_OLD_VIRTUAL_PYTHONHOME
        set -e _OLD_VIRTUAL_PYTHONHOME
    end

    if test -n "$vscode_python_old_fish_prompt_OVERRIDE"
        set -e vscode_python_old_fish_prompt_OVERRIDE
        if functions -q vscode_python_old_fish_prompt
            functions -e fish_prompt
            functions -c vscode_python_old_fish_prompt fish_prompt
            functions -e vscode_python_old_fish_prompt
        end
    end

    set -e VIRTUAL_ENV
    set -e VIRTUAL_ENV_PROMPT
    if test "$argv[1]" != "nondestructive"
        functions -e deactivate
    end
end

# Initialize the variables required by deactivate function
set -gx _OLD_VIRTUAL_PATH $PATH
if test -z "$VIRTUAL_ENV_DISABLE_PROMPT"
    functions -c fish_prompt vscode_python_old_fish_prompt
end
if set -q PYTHONHOME
    set -gx _OLD_VIRTUAL_PYTHONHOME $PYTHONHOME
end
