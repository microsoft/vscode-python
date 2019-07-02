@testing
Feature: Testing
    Scenario Outline: Prompt to configure tests when not configured and attempting to discover tests
        If user has not configured the extension for testing, then prompt to configure.
        This should happen when selecting test specific commands.
        Given the file ".vscode/settings.json" does not exist
        When I wait for the Python extension to activate
        And I select the command "<command>"
        Then a message containing the text "No test framework configured" is displayed

        Examples:
            | command                       |
            | Python: Discover Tests        |
            | Python: Run All Tests         |
            | Python: Debug All Tests       |
            | Python: Debug Test Method ... |
            | Python: Run Test Method ...   |
            | Python: Run Failed Tests      |

    Scenario Outline: Prompt to install <package> when discovering tests
        Given the package "<package>" is not installed
        And the workspace setting "python.testing.<setting_to_enable>" is enabled
        When I wait for the Python extension to activate
        And I select the command "Python: Discover Tests"
        Then a message containing the text "<message>" is displayed

        Examples:
            | package | setting_to_enable | message                   |
            | pytest  | pytestEnabled     | pytest is not installed   |
            | nose    | nosetestsEnabled  | nosetest is not installed |

    Scenario Outline: Display message if there are no tests (<package>)
        Given a file named ".vscode/settings.json" is created with the following contents
            """
            {
            "python.testing.<args_setting>": <args>,
            "python.testing.<setting_to_enable>": true
            }
            """
        And the package "<package>" is installed
        When I wait for the Python extension to activate
        And I select the command "Python: Discover Tests"
        Then a message containing the text "No tests discovered" is displayed

        Examples:
            | package  | setting_to_enable | args_setting | args                             |
            | unittest | unittestEnabled   | unittestArgs | ["-v","-s",".","-p","*test*.py"] |
            | pytest   | pytestEnabled     | pytestArgs   | ["."]                            |
            | nose     | nosetestsEnabled  | nosetestArgs | ["."]                            |
