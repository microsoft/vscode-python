@ls
Feature: Language Server
    Background: Unresolved imports with Language Server
        Given a file named "sample.py" is created with the following content
            """
        import requests
            """
        Given the workspace setting "python.jediEnabled" is disabled
        Given the package "requests" is not installed
        When I reload VS Code
        And I open the file "sample.py"
        And I wait for the Python extension to activate
        And I select the command "Python: Show Output"
        Then the text "Microsoft Python language server" will be displayed in the output panel within 120 seconds
        When I select the command "Python: Show Language Server Output"
        Then the text "Initializing for" will be displayed in the output panel within 120 seconds
        # Sometimes LS is slow.
        When I wait for 10 seconds
        Then the status bar item containing the text "Analyzing in background" will be hidden within 120 seconds
        When I select the command "View: Focus Problems (Errors, Warnings, Infos)"
        Then there is at least one problem in the problems panel
        And there is a problem with the file named "sample.py"
        And there is a problem with the message "unresolved import 'requests'"

    Scenario: Display problem about unresolved imports
            """
        Just execute the background and ensure problems are displayed.
            """
        Then do nothing

    Scenario: There should be no problem related to unresolved imports when reloading VSC
        When I install the package "requests"
        When I reload VS Code
        # Wait for some time for LS to detect this.
        # And I wait for 5 seconds
        And I open the file "sample.py"
        And I wait for the Python extension to activate
        And I select the command "Python: Show Output"
        Then the text "Microsoft Python language server" will be displayed in the output panel within 120 seconds
        When I select the command "Python: Show Language Server Output"
        Then the text "Initializing for" will be displayed in the output panel within 120 seconds
        # Sometimes LS is slow.
        When I wait for 10 seconds
        Then the status bar item containing the text "Analyzing in background" will be hidden within 120 seconds
        When I select the command "View: Focus Problems (Errors, Warnings, Infos)"
        # Ensure we are not too eager, possible LS hasn't analyzed yet.
        Then there are no problems in the problems panel within 30 seconds

    @skip
    Scenario: Unresolved import message should go away when package is installed
        When I install the package "requests"
        # Ensure we are not too eager, possible LS hasn't analyzed yet.
        Then there are no problems in the problems panel within 30 seconds
