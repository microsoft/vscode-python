* InsidersExtensionService implements IExtensionService
    * activate
        - If hasUserConfiguredChannel or activatedOnce, return
        - registerCommandsAndHandlers
        - get download channel
        - handleChannel
    * handleChannel(channel)
        - If channel rules allows insiders
            - downloadInsiders
            - Installs VSIX
        - If channel rules allows stable
            - Install stable
        - if using VSCODE-INSIDERS (?)
            - Prompts
        - Make sure we are asking user to reload in case we install
    * registerCommandsAndHandlers()
        - OnChannelChange(channel)
            - handleChannel

* InsidersPrompt
    * notifyUser
        - If user haven't configured a channel, prompt user
        - Configure channels accordingly
    * useStable
        - set download channel to stable

* InsidersDownloadChannelRules implements IInsidersDownloadChannelRules
    * stable
        - shouldLookForInsidersBuild()
            - if using VSCODE-INSIDERS and if using default channel configuration
                - look for insiders
        - shouldLookForStableBuild()
            - if using VSCODE-INSIDERS and if using default channel configuration
                - look for insiders
    * weekly
    * daily

* InsidersDownloadChannelService
    * getDownloadChannel
    * setDownloadChannel
    * onChannelChange
    * hasUserConfiguredChannel

* ExtensionInstaller
    * downloadInsiders()
    * installUsingVSIX
    * installStable - use PVSC_EXTENSION_ID

Modify config settings to add new setting

Modify application environment to add if using VSCODE insiders method

Problems:
- User switches to 'stable' while extension is not active, we should be looking for 'stable' in that case
- When to prompt user for reload - When Channel is changed midway (but not when 'use stable' option is selected in the prompt)

Expected runs:
    - Default channel is stable
    - Download and install insiders
    - Prompt user to 'reload' to use insiders, or click 'use stable'
    - Option 1 - 'reload'
        - Setting gets changed to 'InsidersWeekly' and we reload
    - Option 2 - 'use stable'
