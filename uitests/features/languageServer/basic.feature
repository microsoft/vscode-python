@ls
@code:code/languageServer/basic
Feature: Language Server
    @smoke
    Scenario: Check output of 'Python' output panel when starting VS Code with Jedi enabled
        When I enable the workspace setting "python.jediEnabled"
        And I wait for the Python extension to activate
        And I select the command "Python: Show Output"
        Then the text "Jedi Python language engine" will be displayed in the output panel within 10 seconds

    @smoke
    Scenario: Check output of 'Python' and 'Python Language Server' output panel when starting VS Code with Language Server enabled
        When I disable the workspace setting "python.jediEnabled"
        And I wait for the Python extension to activate
        And I select the command "Python: Show Output"
        Then the text "Microsoft Python language server" will be displayed in the output panel within 120 seconds
        When I select the command "Python: Show Language Server Output"
        Then the text "Initializing for" will be displayed in the output panel within 120 seconds

    @noNeedToTestInAllPython
    Scenario Outline: Language Server is downloaded with http.proxyStrictSSL setting <enabled_disabled>
        When I open VS Code for the first time
        And I disable the workspace setting "python.jediEnabled"
        And the user setting "http.proxyStrictSSL" is <enabled_disabled>
        And I wait for the Python extension to activate
        And I select the command "Python: Show Output"
        Then the text "Microsoft Python language server" will be displayed in the output panel within 120 seconds
        When I select the command "Python: Show Language Server Output"
        Then the text "<protocol_to_look_for>" will be displayed in the output panel within 120 seconds
        Then the text "Initializing for" will be displayed in the output panel within 120 seconds

        Examples:
            | enabled_disabled | protocol_to_look_for |
            | enabled          | Downloading https:// |
            | disabled         | Downloading http://  |
