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
