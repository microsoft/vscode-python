# import sys

# original_ps1 = ">>> "


# class repl_hooks:
#     def __init__(self):
#         self.global_exit = None
#         self.failure_flag = False
#         self.original_excepthook = sys.excepthook
#         self.original_displayhook = sys.displayhook
#         sys.excepthook = self.my_excepthook
#         sys.displayhook = self.my_displayhook

#     def my_displayhook(self, value):
#         if value is None:
#             self.failure_flag = False

#         self.original_displayhook(value)

#     def my_excepthook(self, type, value, traceback):
#         self.global_exit = value
#         self.failure_flag = True

#         self.original_excepthook(type, value, traceback)


# class ps1:
#     hooks = repl_hooks()
#     sys.excepthook = hooks.my_excepthook
#     sys.displayhook = hooks.my_displayhook

#     # str will get called for every prompt with exit code to show success/failure
#     def __str__(self):
#         exit_code = 0
#         if self.hooks.failure_flag:
#             exit_code = 1
#         else:
#             exit_code = 0

#         # Guide following official VS Code doc for shell integration sequence:
#         # result = "{command_finished}{prompt_started}{prompt}{command_start}{command_executed}".format(
#         #     command_finished="\x1b]633;D;" + str(exit_code) + "\x07",
#         #     prompt_started="\x1b]633;A\x07",
#         #     prompt=original_ps1,
#         #     command_start="\x1b]633;B\x07",
#         #     command_executed="\x1b]633;C\x07",
#         # )
#         result = f"{chr(27)}]633;D;{exit_code}{chr(7)}{chr(27)}]633;A{chr(7)}{original_ps1}{chr(27)}]633;B{chr(7)}{chr(27)}]633;C{chr(7)}"

#         return result


# if sys.platform != "win32":
#     sys.ps1 = ps1()
