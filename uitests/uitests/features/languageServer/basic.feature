@ls @smoke
@https://github.com/DonJayamanne/pvscSmokeLS.git
Feature: Language Server
    Scenario Outline: Check output of 'Python' output panel when starting VS Code with Jedi <jedi_enabled>
        Given the workspace setting "python.jediEnabled" is <jedi_enabled>
        When I reload VS Code
        And I wait for the Python extension to activate
        And I select the command "Python: Show Output"
        Then the text "<first_text_in_ooutput_panel>" will be displayed in the output panel within <time_to_activate> seconds
        And the text "<second_text_in_output_panel>" will be displayed in the output panel within <time_to_activate> seconds

        Examples:
            | jedi_enabled | time_to_activate | first_text_in_ooutput_panel      | second_text_in_output_panel |
            | enabled      | 5                | Jedi Python language engine      | Jedi Python language engine |
            | disabled     | 120              | Microsoft Python language server | Initializing for            |

    Scenario Outline: Language Server is downloaded with http.proxyStrictSSL set to true and false
        When I open VS Code for the first time
        Given the workspace setting "python.jediEnabled" is disabled
        And the user setting "http.proxyStrictSSL" is <enabled_disabled>
        When I wait for the Python extension to activate
        And I select the command "Python: Show Output"
        Then the text "Microsoft Python language server" will be displayed in the output panel within 120 seconds
        Then the text "<protocol_to_look_for>" will be displayed in the output panel within 120 seconds
        And the text "Initializing for" will be displayed in the output panel within 120 seconds

        Examples:
            | enabled_disabled | protocol_to_look_for |
            | enabled          | https://             |
            | disabled         | http://              |

    @autoretry
    Scenario Outline: Navigate to definition of a variable when extension has already been activated with Jedi <jedi_enabled>
        Given the workspace setting "python.jediEnabled" is <jedi_enabled>
        When I reload VS Code
        And I wait for the Python extension to activate
        And I select the command "Python: Show Output"
        Then the text "<first_text_in_ooutput_panel>" will be displayed in the output panel within <time_to_activate> seconds
        And the text "<second_text_in_output_panel>" will be displayed in the output panel within <time_to_activate> seconds
        When I open the file "my_sample.py"
        And I go to line 3, column 10
        # Wait for intellisense to kick in (sometimes slow in jedi & ls)
        And I wait for 5 seconds
        When I select the command "Go to Definition"
        Then the cursor is on line 1

        Examples:
            | jedi_enabled | time_to_activate | first_text_in_ooutput_panel      | second_text_in_output_panel |
            | enabled      | 5                | Jedi Python language engine      | Jedi Python language engine |
            | disabled     | 120              | Microsoft Python language server | Initializing for            |

    @autoretry
    Scenario Outline: Navigate to definition of a variable after opening a file with Jedi <jedi_enabled>
        Given the workspace setting "python.jediEnabled" is <jedi_enabled>
        When I open the file "my_sample.py"
        And I select the command "Python: Show Output"
        Then the text "<first_text_in_ooutput_panel>" will be displayed in the output panel within <time_to_activate> seconds
        And the text "<second_text_in_output_panel>" will be displayed in the output panel within <time_to_activate> seconds
        When I go to line 3, column 10
        # Wait for intellisense to kick in (sometimes slow in jedi & ls)
        And I wait for 5 seconds
        And I select the command "Go to Definition"
        Then the cursor is on line 1

        Examples:
            | jedi_enabled | time_to_activate | first_text_in_ooutput_panel      | second_text_in_output_panel |
            | enabled      | 5                | Jedi Python language engine      | Jedi Python language engine |
            | disabled     | 120              | Microsoft Python language server | Initializing for            |
