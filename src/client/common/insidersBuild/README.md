* InsidersExtensionService implements IExtensionService
    * activate
        - registerCommand
        - get download channel
        - handleChannel
    * handleChannel()
        - If channel rules allows insiders
            - downloadInsiders
            - Installs VSIX
            - IF USING VSCODE-INSIDERS (?)
                - Prompts
        - If channel is stable, install stable
    * registerCommands()
    * OnEvent(channel)
        - handleChannel

* InsidersPrompt
    * notifyUser
        - If user haven't configured a channel, prompt user
        - Configure channels accordingly
    * useStable
        - set download channel to stable

* InsidersDownloadChannelRules implements IInsidersDownloadChannelRules
    * stable
    * weekly
    * daily

* InsidersDownloadChannelService
    * getDownloadChannel
    * setDownloadChannel
    * onChannelChange

* ExtensionInstaller
    * downloadInsiders()
    * installUsingVSIX
    * installStable - use PVSC_EXTENSION_ID

Modify config settings to add new setting

Modify application environment to add if using VSCODE insiders method
