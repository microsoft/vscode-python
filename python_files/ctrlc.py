# This file sends keyboard interrupt to Windows Python REPL instance
import ctypes
import sys

kernel = ctypes.windll.kernel32

pid = int(sys.argv[1])
kernel.FreeConsole()
kernel.AttachConsole(pid)
kernel.SetConsoleCtrlHandler(None, 1)
kernel.GenerateConsoleCtrlEvent(0, 0)
sys.exit(0)
