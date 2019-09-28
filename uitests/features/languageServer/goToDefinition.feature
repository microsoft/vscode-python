@ls
@code:code/languageServer/basic
Feature: Language Server
    Scenario Outline: When <reload_or_start_vs_for_first_time> with Jedi <jedi_enable>d then output contains <text_in_output_panel>
        When <reload_or_start_vs_for_first_time>
        And I <jedi_enable> the workspace setting "python.jediEnabled"
        And I wait for the Python extension to activate
        And I select the command "<output_panel_command>"
        Then the text "<text_in_output_panel>" will be displayed in the output panel within <time_to_activate> seconds

        Examples:
            | jedi_enable | reload_or_start_vs_for_first_time | time_to_activate | text_in_output_panel             | output_panel_command                |
            | enable      | I open VS Code for the first time | 5                | Jedi Python language engine      | Python: Show Output                 |
            | enable      | I reload VS Code                  | 5                | Jedi Python language engine      | Python: Show Output                 |
            | disable     | I open VS Code for the first time | 120              | Microsoft Python language server | Python: Show Output                 |
            | disable     | I open VS Code for the first time | 120              | Downloading                      | Python: Show Language Server Output |
            | disable     | I reload VS Code                  | 120              | Microsoft Python language server | Python: Show Output                 |

    @autoretry
    Scenario Outline: When <reload_or_start_vs_for_first_time> with Jedi <jedi_enable>d then navigate to definition of a variable
        When <reload_or_start_vs_for_first_time>
        And I <jedi_enable> the workspace setting "python.jediEnabled"
        And I wait for the Python extension to activate
        And I select the command "<output_panel_command>"
        Then the text "<text_in_output_panel>" will be displayed in the output panel within <time_to_activate> seconds
        # Because LS is slow.
        And wait for <time_to_activate> seconds
        When I open the file "my_sample.py"
        And I go to line 3, column 10
        # Wait for intellisense to kick in (sometimes slow in jedi & ls)
        And I wait for 5 seconds
        And I select the command "Go to Definition"
        Then the cursor is on line 1

        Examples:
            | jedi_enable | reload_or_start_vs_for_first_time | time_to_activate | text_in_output_panel             | output_panel_command                |
            | enable      | I open VS Code for the first time | 5                | Jedi Python language engine      | Python: Show Output                 |
            | enable      | I reload VS Code                  | 5                | Jedi Python language engine      | Python: Show Output                 |
            | disable     | I open VS Code for the first time | 120              | Microsoft Python language server | Python: Show Output                 |
            | disable     | I open VS Code for the first time | 120              | Downloading                      | Python: Show Language Server Output |
            | disable     | I reload VS Code                  | 120              | Microsoft Python language server | Python: Show Output                 |

    @autoretry
    Scenario Outline: When I open VS Code for the first time with Jedi <jedi_enable>d, open a file then navigate to definition of a variable
        When I open VS Code for the first time
        And I <jedi_enable> the workspace setting "python.jediEnabled"
        And I select the command "Python: Show Output"
        And I wait for the Python extension to activate
        And I open the file "my_sample.py"
        And I select the command "<output_panel_command>"
        Then the text "<text_in_output_panel>" will be displayed in the output panel within <time_to_activate> seconds
        # Because LS is slow.
        And wait for <time_to_activate> seconds
        When I go to line 3, column 10
        # Wait for intellisense to kick in (sometimes slow in jedi & ls)
        And I wait for 5 seconds
        And I select the command "Go to Definition"
        Then the cursor is on line 1

        Examples:
            | jedi_enable | time_to_activate | text_in_output_panel             | output_panel_command                |
            | enable      | 5                | Jedi Python language engine      | Python: Show Output                 |
            | disable     | 120              | Microsoft Python language server | Python: Show Output                 |
            | disable     | 120              | Downloading                      | Python: Show Language Server Output |
