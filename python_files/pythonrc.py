def _initialize():
    import sys

    if sys.platform != "win32":
        import readline

    original_ps1 = getattr(sys, "ps1", ">>> ")
    # PYTHONSTARTUP executes this file's code inside the user's __main__
    # namespace, so PS1.__str__'s globals are the user's globals. If the
    # user later shadows a name we rely on at prompt-render time (e.g.
    # `int = 20`, `sys = 1`), a plain lookup would resolve to the user's
    # value instead of ours and raise, silently killing the prompt.
    #
    # Capturing these as locals of _initialize (rather than as names left
    # sitting in __main__) means PS1's methods reach them through closure
    # cells, not global lookup - so there's no alias name in __main__ for
    # user code to reassign and break in the first place.
    _int = int
    _bool = bool

    # https://code.visualstudio.com/docs/terminal/shell-integration#_supported-escape-sequences
    class ShellIntegrationSequence:
        soh = "\001"
        stx = "\002"
        template = "\x1b]633;{}\x07"

        # Before the prompt (>>>) is displayed
        @classmethod
        def prompt_start(cls) -> str:
            return cls.template.format("A")

        # After the prompt (>>>) is displayed
        @classmethod
        def prompt_end(cls) -> str:
            return cls.template.format("B")

        # After the user has typed a command but before it is executed
        @classmethod
        def pre_execution(cls) -> str:
            return cls.template.format("C")

        @classmethod
        def execution_finished(cls, exit_code: int) -> str:
            """Mark execution as finished with its exit code."""
            return cls.template.format(f"D;{exit_code}")

        @classmethod
        def command_line(cls, command: object) -> str:
            """Explicitly set the command line interpreted by the shell."""
            return cls.template.format(f"E;{command}")

    class REPLHooks:
        def __init__(self):
            self.global_exit = None
            self.last_failure_flag = False
            self.original_excepthook = sys.excepthook
            self.original_displayhook = sys.displayhook
            sys.excepthook = self.vscode_excepthook
            sys.displayhook = self.vscode_displayhook

        def vscode_displayhook(self, value):
            if value is None:
                self.last_failure_flag = False
            self.original_displayhook(value)

        def vscode_excepthook(self, type_, value, traceback):
            self.global_exit = value
            self.last_failure_flag = True
            self.original_excepthook(type_, value, traceback)

    def get_last_command():
        # Get the last history item
        last_command = ""
        if sys.platform != "win32":
            last_command = readline.get_history_item(readline.get_current_history_length())
        return last_command

    class PS1:
        hooks = REPLHooks()

        # str will get called for every prompt with exit code to show success/failure
        def __str__(self):
            last_exit_code = _int(_bool(self.hooks.last_failure_flag))
            self.hooks.last_failure_flag = False
            # Guide following official VS Code doc for shell integration sequence:
            result = ""
            # For non-windows allow recent_command history.
            # fmt: off
            if sys.platform != "win32":
                result = "{soh}{command_line}{pre_execution}{execution_finished}{prompt_start}{stx}{prompt}{soh}{prompt_end}{stx}".format(  # noqa: UP032
                    soh=ShellIntegrationSequence.soh,
                    command_line=ShellIntegrationSequence.command_line(get_last_command()),
                    pre_execution=ShellIntegrationSequence.pre_execution(),
                    execution_finished=ShellIntegrationSequence.execution_finished(last_exit_code),
                    prompt_start=ShellIntegrationSequence.prompt_start(),
                    stx=ShellIntegrationSequence.stx,
                    prompt=original_ps1,
                    prompt_end=ShellIntegrationSequence.prompt_end(),
                )
            else:
                result = "{execution_finished}{prompt_start}{prompt}{prompt_end}{pre_execution}".format(  # noqa: UP032
                    execution_finished=ShellIntegrationSequence.execution_finished(last_exit_code),
                    prompt_start=ShellIntegrationSequence.prompt_start(),
                    prompt=original_ps1,
                    prompt_end=ShellIntegrationSequence.prompt_end(),
                    pre_execution=ShellIntegrationSequence.pre_execution(),
                )
            # fmt: on

            return result

        def __repr__(self):
            return "<Custom PS1 for VS Code Python Shell Integration>"

    # if sys.platform != "win32" and (not is_wsl):
    #     sys.ps1 = PS1()

    sys.ps1 = PS1()

    ctrl_key = "Cmd" if sys.platform == "darwin" else "Ctrl"

    print(f"{ctrl_key} click to launch VS Code Native REPL (https://aka.ms/python-native-repl)")


_initialize()
del _initialize
