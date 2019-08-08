@ls
@https://github.com/DonJayamanne/pvscSmokeLS.git
Feature: Language Server
    @autoretry
    Scenario Outline: When <reload_or_start_vs_for_first_time> with Jedi <jedi_enable>d then intellisense works
        When <reload_or_start_vs_for_first_time>
        And I <jedi_enable> the workspace setting "python.jediEnabled"
        And I wait for the Python extension to activate
        And I select the command "Python: Show Output"
        Then the text "<first_text_in_ooutput_panel>" will be displayed in the output panel within <time_to_activate> seconds
        And wait for <time_to_activate> seconds
        # Get more realestate on UI (hide what we don't need).
        And select the command "View: Close Panel"
        When I open the file "intelli_sample.py"
        # Wait for intellisense to kick in (sometimes slow in jedi & ls)
        And I wait for <wait_time> seconds
        And I go to line 3, column 13
        And I press ctrl+space
        Then auto completion list contains the item "excepthook"
        And auto completion list contains the item "exec_prefix"
        And auto completion list contains the item "executable"
        When I go to line 11, column 21
        And I press ctrl+space
        Then auto completion list contains the item "age"
        When I go to line 12, column 21
        And I press ctrl+space
        Then auto completion list contains the item "name"
        When I go to line 17, column 10
        And I press ctrl+space
        Then auto completion list contains the item "say_something"
        When I go to line 18, column 10
        And I press ctrl+space
        Then auto completion list contains the item "age"
        When I go to line 19, column 10
        And I press ctrl+space
        Then auto completion list contains the item "name"
        When I go to line 17, column 24
        And I press .
        Then auto completion list contains the item "capitalize"
        And auto completion list contains the item "count"

        Examples:
            | jedi_enable | reload_or_start_vs_for_first_time | time_to_activate | first_text_in_ooutput_panel      | wait_time |
            | enable      | I open VS Code for the first time | 5                | Jedi Python language engine      | 5         |
            | enable      | I reload VS Code                  | 5                | Jedi Python language engine      | 5         |
            | disable     | I open VS Code for the first time | 120              | Microsoft Python language server | 5         |
            | disable     | I reload VS Code                  | 120              | Microsoft Python language server | 5         |

    @autoretry
    Scenario Outline: When <reload_or_start_vs_for_first_time> with Jedi <jedi_enable>d then intellisense works for untitled files
        When <reload_or_start_vs_for_first_time>
        And I <jedi_enable> the workspace setting "python.jediEnabled"
        And I wait for the Python extension to activate
        And I select the command "Python: Show Output"
        Then the text "<first_text_in_ooutput_panel>" will be displayed in the output panel within <time_to_activate> seconds
        And wait for <time_to_activate> seconds
        # Get more realestate on UI (hide what we don't need).
        And select the command "View: Close Panel"
        When I create a new file with the following content
            """
            import sys

            print(sys.executable)
            """
        And I change the language of the file to "Python"
        # Wait for intellisense to kick in (sometimes slow in jedi & ls)
        And I wait for <wait_time> seconds
        And I go to line 3, column 13
        And I press ctrl+space
        Then auto completion list contains the item "excepthook"
        And auto completion list contains the item "exec_prefix"
        And auto completion list contains the item "executable"

        Examples:
            | jedi_enable | reload_or_start_vs_for_first_time | time_to_activate | first_text_in_ooutput_panel      | wait_time |
            | enable      | I open VS Code for the first time | 5                | Jedi Python language engine      | 5         |
            | enable      | I reload VS Code                  | 5                | Jedi Python language engine      | 5         |
            | disable     | I open VS Code for the first time | 120              | Microsoft Python language server | 5         |
            | disable     | I reload VS Code                  | 120              | Microsoft Python language server | 5         |
