import platform
import sys
from enum import Enum

if sys.platform != "win32":
    import readline

original_ps1 = ">>> "
is_wsl = "microsoft-standard-WSL" in platform.release()


class ShellIntegrationSequence(str, Enum):
    SOH = "\001"
    STX = "\002"
    COMMAND_EXECUTED = "\x1b]633;C\x07"
    COMMAND_LINE = "\x1b]633;E;"
    COMMAND_FINISHED = "\x1b]633;D;"
    PROMPT_STARTED = "\x1b]633;A\x07"
    COMMAND_START = "\x1b]633;B\x07"
    TERMINATOR = "\x07"

    def __str__(self):
        return self.value


class REPLHooks:
    def __init__(self):
        self.global_exit = None
        self.failure_flag = False
        self.original_excepthook = sys.excepthook
        self.original_displayhook = sys.displayhook
        sys.excepthook = self.my_excepthook
        sys.displayhook = self.my_displayhook

    def my_displayhook(self, value):
        if value is None:
            self.failure_flag = False

        self.original_displayhook(value)

    def my_excepthook(self, type_, value, traceback):
        self.global_exit = value
        self.failure_flag = True

        self.original_excepthook(type_, value, traceback)


def get_last_command():
    # Get the last history item
    last_command = ""
    if sys.platform != "win32":
        last_command = readline.get_history_item(readline.get_current_history_length())

    return last_command


class PS1:
    hooks = REPLHooks()
    sys.excepthook = hooks.my_excepthook
    sys.displayhook = hooks.my_displayhook

    # str will get called for every prompt with exit code to show success/failure
    def __str__(self):
        exit_code = int(bool(self.hooks.failure_flag))
        self.hooks.failure_flag = False
        # Guide following official VS Code doc for shell integration sequence:
        result = ""
        # For non-windows allow recent_command history.
        if sys.platform != "win32":
            result = "{soh}{command_executed}{command_line}{command_finished}{prompt_started}{stx}{prompt}{soh}{command_start}{stx}".format(
                soh=ShellIntegrationSequence.SOH,
                stx=ShellIntegrationSequence.STX,
                command_executed=ShellIntegrationSequence.COMMAND_EXECUTED,
                command_line=ShellIntegrationSequence.COMMAND_LINE
                + str(get_last_command())
                + ShellIntegrationSequence.TERMINATOR,
                command_finished=ShellIntegrationSequence.COMMAND_FINISHED
                + str(exit_code)
                + ShellIntegrationSequence.TERMINATOR,
                prompt_started=ShellIntegrationSequence.PROMPT_STARTED,
                prompt=original_ps1,
                command_start=ShellIntegrationSequence.COMMAND_START,
            )
        else:
            result = "{command_finished}{prompt_started}{prompt}{command_start}{command_executed}".format(
                command_finished=ShellIntegrationSequence.COMMAND_FINISHED
                + str(exit_code)
                + ShellIntegrationSequence.TERMINATOR,
                prompt_started=ShellIntegrationSequence.PROMPT_STARTED,
                prompt=original_ps1,
                command_start=ShellIntegrationSequence.COMMAND_START,
                command_executed=ShellIntegrationSequence.COMMAND_EXECUTED,
            )

        return result

    def __repr__(self):
        return "<Custom PS1 for VS Code Python Shell Integration>"


if sys.platform != "win32" and (not is_wsl):
    sys.ps1 = PS1()

if sys.platform == "darwin":
    print("Cmd click to launch VS Code Native REPL (https://aka.ms/python-native-repl)")
else:
    print("Ctrl click to launch VS Code Native REPL (https://aka.ms/python-native-repl)")
