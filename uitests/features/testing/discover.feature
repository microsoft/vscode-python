@test
Feature: Testing
    Scenario: Discover will display prompt to configure when not configured
        Given the file ".vscode/settings.json" does not exist
        When the Python extension has activated
        And I select the command "Python: Discover Tests"
        Then a message containing the text "No test framework configured" is displayed

    Scenario Outline: Discover will prompt to install <package>
        Given the package "<package>" is not installed
        And the workspace setting "python.testing.<setting_to_enable>" is enabled
        When the Python extension has activated
        And I select the command "Python: Discover Tests"
        Then a message containing the text "<message>" is displayed

        Examples:
            | package | setting_to_enable | message                   |
            | pytest  | pytestEnabled     | pytest is not installed   |
            | nose    | nosetestsEnabled  | nosetest is not installed |

    Scenario Outline: Discover will display prompt indicating there are no tests (<package>)
        Given a file named ".vscode/settings.json" is created with the following content
            """
            {
            "python.testing.<args_setting>": <args>,
            "python.testing.<setting_to_enable>": true
            }
            """
        And the package "<package>" is installed
        When the Python extension has activated
        And I select the command "Python: Discover Tests"
        Then a message containing the text "No tests discovered" is displayed

        Examples:
            | package  | setting_to_enable | args_setting | args                             |
            | unittest | unittestEnabled   | unittestArgs | ["-v","-s",".","-p","*test*.py"] |
            | pytest   | pytestEnabled     | pytestArgs   | ["."]                            |
            | nose     | nosetestsEnabled  | nosetestArgs | ["."]                            |
