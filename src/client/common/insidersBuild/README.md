Note:
- When to prompt user for reload - When using the prompt, never prompt user to reload after installing, otherwise always prompt user to reload after installing

Expected runs:
    - Default channel is stable
    - Download and install insiders
    - Prompt user to 'reload' to use insiders, or click 'use stable'
    - Option 1 - 'reload'
        - Setting gets changed to 'InsidersWeekly' and we reload
    - Option 2 - 'use stable'
        - Setting gets changed to 'Stable`, we do not reload

Problems:
    - If user removes the setting from setting.json, currently we will be installing insiders again. The official default value is `Stable`, but the default behavior is insiders. (Is it okay?)
