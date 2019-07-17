@ls
@https://github.com/DonJayamanne/pvscSmokeLS.git
Feature: Language Server
    Scenario Outline: When <reload_or_start_vs_for_first_time> with Jedi <jedi_enabled> then output contains <first_text_in_ooutput_panel>
        Given the workspace setting "python.jediEnabled" is <jedi_enabled>
        When <reload_or_start_vs_for_first_time>
        And I select the command "Python: Show Output"
        And I wait for the Python extension to activate
        Then the text "<first_text_in_ooutput_panel>" will be displayed in the output panel within <time_to_activate> seconds
        And the text "<second_text_in_output_panel>" will be displayed in the output panel within <time_to_activate> seconds

        Examples:
            | jedi_enabled | reload_or_start_vs_for_first_time | time_to_activate | first_text_in_ooutput_panel      | second_text_in_output_panel |
            | enabled      | I open VS Code for the first time | 5                | Jedi Python language engine      | Jedi Python language engine |
            | enabled      | I reload VS Code                  | 5                | Jedi Python language engine      | Jedi Python language engine |
            | disabled     | I open VS Code for the first time | 120              | Microsoft Python language server | Initializing for            |
            | disabled     | I open VS Code for the first time | 120              | Downloading                      | Initializing for            |
            | disabled     | I reload VS Code                  | 120              | Microsoft Python language server | Initializing for            |

    @autoretry
    Scenario Outline: When <reload_or_start_vs_for_first_time> with Jedi <jedi_enabled> then navigate to definition of a variable
        Given the workspace setting "python.jediEnabled" is <jedi_enabled>
        When <reload_or_start_vs_for_first_time>
        And I select the command "Python: Show Output"
        And I wait for the Python extension to activate
        Then the text "<first_text_in_ooutput_panel>" will be displayed in the output panel within <time_to_activate> seconds
        And the text "<second_text_in_output_panel>" will be displayed in the output panel within <time_to_activate> seconds
        When I open the file "my_sample.py"
        And I go to line 3, column 10
        # Wait for intellisense to kick in (sometimes slow in jedi & ls)
        And I wait for 5 seconds
        And I select the command "Go to Definition"
        Then the cursor is on line 1

        Examples:
            | jedi_enabled | reload_or_start_vs_for_first_time | time_to_activate | first_text_in_ooutput_panel      | second_text_in_output_panel |
            | enabled      | I open VS Code for the first time | 5                | Jedi Python language engine      | Jedi Python language engine |
            | enabled      | I reload VS Code                  | 5                | Jedi Python language engine      | Jedi Python language engine |
            | disabled     | I open VS Code for the first time | 120              | Microsoft Python language server | Initializing for            |
            | disabled     | I open VS Code for the first time | 120              | Downloading                      | Initializing for            |
            | disabled     | I reload VS Code                  | 120              | Microsoft Python language server | Initializing for            |

    @autoretry
    Scenario Outline: When I open VS Code for the first time with Jedi <jedi_enabled>, open a file then navigate to definition of a variable
        Given the workspace setting "python.jediEnabled" is <jedi_enabled>
        When I open VS Code for the first time
        And I select the command "Python: Show Output"
        And I wait for the Python extension to activate
        And I open the file "my_sample.py"
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
            | disabled     | 120              | Downloading                      | Initializing for            |
