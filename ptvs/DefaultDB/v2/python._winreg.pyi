import __builtin__
import exceptions

def CloseKey(hkey):
    'CloseKey(hkey) - Closes a previously opened registry key.\n\nThe hkey argument specifies a previously opened key.\n\nNote that if the key is not closed using this method, it will be\nclosed when the hkey object is destroyed by Python.'
    pass

def ConnectRegistry():
    'key = ConnectRegistry(computer_name, key) - Establishes a connection to a predefined registry handle on another computer.\n\ncomputer_name is the name of the remote computer, of the form \\\\computername.\n If None, the local computer is used.\nkey is the predefined handle to connect to.\n\nThe return value is the handle of the opened key.\nIf the function fails, a WindowsError exception is raised.'
    pass

def CreateKey():
    'key = CreateKey(key, sub_key) - Creates or opens the specified key.\n\nkey is an already open key, or one of the predefined HKEY_* constants\nsub_key is a string that names the key this method opens or creates.\n If key is one of the predefined keys, sub_key may be None. In that case,\n the handle returned is the same key handle passed in to the function.\n\nIf the key already exists, this function opens the existing key\n\nThe return value is the handle of the opened key.\nIf the function fails, an exception is raised.'
    pass

def CreateKeyEx():
    'key = CreateKeyEx(key, sub_key, res, sam) - Creates or opens the specified key.\n\nkey is an already open key, or one of the predefined HKEY_* constants\nsub_key is a string that names the key this method opens or creates.\nres is a reserved integer, and must be zero.  Default is zero.\nsam is an integer that specifies an access mask that describes the desired\n If key is one of the predefined keys, sub_key may be None. In that case,\n the handle returned is the same key handle passed in to the function.\n\nIf the key already exists, this function opens the existing key\n\nThe return value is the handle of the opened key.\nIf the function fails, an exception is raised.'
    pass

def DeleteKey(key, sub_key):
    'DeleteKey(key, sub_key) - Deletes the specified key.\n\nkey is an already open key, or any one of the predefined HKEY_* constants.\nsub_key is a string that must be a subkey of the key identified by the key parameter.\n This value must not be None, and the key may not have subkeys.\n\nThis method can not delete keys with subkeys.\n\nIf the method succeeds, the entire key, including all of its values,\nis removed.  If the method fails, a WindowsError exception is raised.'
    pass

def DeleteKeyEx(key, sub_key, sam, res):
    'DeleteKeyEx(key, sub_key, sam, res) - Deletes the specified key.\n\nkey is an already open key, or any one of the predefined HKEY_* constants.\nsub_key is a string that must be a subkey of the key identified by the key parameter.\nres is a reserved integer, and must be zero.  Default is zero.\nsam is an integer that specifies an access mask that describes the desired\n This value must not be None, and the key may not have subkeys.\n\nThis method can not delete keys with subkeys.\n\nIf the method succeeds, the entire key, including all of its values,\nis removed.  If the method fails, a WindowsError exception is raised.\nOn unsupported Windows versions, NotImplementedError is raised.'
    pass

def DeleteValue(key, value):
    'DeleteValue(key, value) - Removes a named value from a registry key.\n\nkey is an already open key, or any one of the predefined HKEY_* constants.\nvalue is a string that identifies the value to remove.'
    pass

def DisableReflectionKey():
    'Disables registry reflection for 32-bit processes running on a 64-bit\nOperating System.  Will generally raise NotImplemented if executed on\na 32-bit Operating System.\nIf the key is not on the reflection list, the function succeeds but has no effect.\nDisabling reflection for a key does not affect reflection of any subkeys.'
    pass

def EnableReflectionKey():
    'Restores registry reflection for the specified disabled key.\nWill generally raise NotImplemented if executed on a 32-bit Operating System.\nRestoring reflection for a key does not affect reflection of any subkeys.'
    pass

def EnumKey():
    'string = EnumKey(key, index) - Enumerates subkeys of an open registry key.\n\nkey is an already open key, or any one of the predefined HKEY_* constants.\nindex is an integer that identifies the index of the key to retrieve.\n\nThe function retrieves the name of one subkey each time it is called.\nIt is typically called repeatedly until a WindowsError exception is\nraised, indicating no more values are available.'
    pass

def EnumValue():
    'tuple = EnumValue(key, index) - Enumerates values of an open registry key.\nkey is an already open key, or any one of the predefined HKEY_* constants.\nindex is an integer that identifies the index of the value to retrieve.\n\nThe function retrieves the name of one subkey each time it is called.\nIt is typically called repeatedly, until a WindowsError exception\nis raised, indicating no more values.\n\nThe result is a tuple of 3 items:\nvalue_name is a string that identifies the value.\nvalue_data is an object that holds the value data, and whose type depends\n on the underlying registry type.\ndata_type is an integer that identifies the type of the value data.'
    pass

def ExpandEnvironmentStrings():
    'string = ExpandEnvironmentStrings(string) - Expand environment vars.\n'
    pass

def FlushKey(key):
    "FlushKey(key) - Writes all the attributes of a key to the registry.\n\nkey is an already open key, or any one of the predefined HKEY_* constants.\n\nIt is not necessary to call RegFlushKey to change a key.\nRegistry changes are flushed to disk by the registry using its lazy flusher.\nRegistry changes are also flushed to disk at system shutdown.\nUnlike CloseKey(), the FlushKey() method returns only when all the data has\nbeen written to the registry.\nAn application should only call FlushKey() if it requires absolute certainty that registry changes are on disk.\nIf you don't know whether a FlushKey() call is required, it probably isn't."
    pass

HKEYType = __builtin__.PyHKEY
HKEY_CLASSES_ROOT = 18446744071562067968L
HKEY_CURRENT_CONFIG = 18446744071562067973L
HKEY_CURRENT_USER = 18446744071562067969L
HKEY_DYN_DATA = 18446744071562067974L
HKEY_LOCAL_MACHINE = 18446744071562067970L
HKEY_PERFORMANCE_DATA = 18446744071562067972L
HKEY_USERS = 18446744071562067971L
KEY_ALL_ACCESS = 983103
KEY_CREATE_LINK = 32
KEY_CREATE_SUB_KEY = 4
KEY_ENUMERATE_SUB_KEYS = 8
KEY_EXECUTE = 131097
KEY_NOTIFY = 16
KEY_QUERY_VALUE = 1
KEY_READ = 131097
KEY_SET_VALUE = 2
KEY_WOW64_32KEY = 512
KEY_WOW64_64KEY = 256
KEY_WRITE = 131078
def LoadKey(key, sub_key, file_name):
    'LoadKey(key, sub_key, file_name) - Creates a subkey under the specified key\nand stores registration information from a specified file into that subkey.\n\nkey is an already open key, or any one of the predefined HKEY_* constants.\nsub_key is a string that identifies the sub_key to load\nfile_name is the name of the file to load registry data from.\n This file must have been created with the SaveKey() function.\n Under the file allocation table (FAT) file system, the filename may not\nhave an extension.\n\nA call to LoadKey() fails if the calling process does not have the\nSE_RESTORE_PRIVILEGE privilege.\n\nIf key is a handle returned by ConnectRegistry(), then the path specified\nin fileName is relative to the remote computer.\n\nThe docs imply key must be in the HKEY_USER or HKEY_LOCAL_MACHINE tree'
    pass

def OpenKey():
    'key = OpenKey(key, sub_key, res = 0, sam = KEY_READ) - Opens the specified key.\n\nkey is an already open key, or any one of the predefined HKEY_* constants.\nsub_key is a string that identifies the sub_key to open\nres is a reserved integer, and must be zero.  Default is zero.\nsam is an integer that specifies an access mask that describes the desired\n security access for the key.  Default is KEY_READ\n\nThe result is a new handle to the specified key\nIf the function fails, a WindowsError exception is raised.'
    pass

def OpenKeyEx():
    'See OpenKey()'
    pass

def QueryInfoKey():
    "tuple = QueryInfoKey(key) - Returns information about a key.\n\nkey is an already open key, or any one of the predefined HKEY_* constants.\n\nThe result is a tuple of 3 items:An integer that identifies the number of sub keys this key has.\nAn integer that identifies the number of values this key has.\nA long integer that identifies when the key was last modified (if available)\n as 100's of nanoseconds since Jan 1, 1600."
    pass

def QueryReflectionKey():
    'bool = QueryReflectionKey(hkey) - Determines the reflection state for the specified key.\nWill generally raise NotImplemented if executed on a 32-bit Operating System.\n'
    pass

def QueryValue():
    "string = QueryValue(key, sub_key) - retrieves the unnamed value for a key.\n\nkey is an already open key, or any one of the predefined HKEY_* constants.\nsub_key is a string that holds the name of the subkey with which the value\n is associated.  If this parameter is None or empty, the function retrieves\n the value set by the SetValue() method for the key identified by key.\nValues in the registry have name, type, and data components. This method\nretrieves the data for a key's first value that has a NULL name.\nBut the underlying API call doesn't return the type, Lame Lame Lame, DONT USE THIS!!!"
    pass

def QueryValueEx():
    'value,type_id = QueryValueEx(key, value_name) - Retrieves the type and data for a specified value name associated with an open registry key.\n\nkey is an already open key, or any one of the predefined HKEY_* constants.\nvalue_name is a string indicating the value to query'
    pass

REG_BINARY = 3
REG_CREATED_NEW_KEY = 1
REG_DWORD = 4
REG_DWORD_BIG_ENDIAN = 5
REG_DWORD_LITTLE_ENDIAN = 4
REG_EXPAND_SZ = 2
REG_FULL_RESOURCE_DESCRIPTOR = 9
REG_LEGAL_CHANGE_FILTER = 15
REG_LEGAL_OPTION = 15
REG_LINK = 6
REG_MULTI_SZ = 7
REG_NONE = 0
REG_NOTIFY_CHANGE_ATTRIBUTES = 2
REG_NOTIFY_CHANGE_LAST_SET = 4
REG_NOTIFY_CHANGE_NAME = 1
REG_NOTIFY_CHANGE_SECURITY = 8
REG_NO_LAZY_FLUSH = 4
REG_OPENED_EXISTING_KEY = 2
REG_OPTION_BACKUP_RESTORE = 4
REG_OPTION_CREATE_LINK = 2
REG_OPTION_NON_VOLATILE = 0
REG_OPTION_OPEN_LINK = 8
REG_OPTION_RESERVED = 0
REG_OPTION_VOLATILE = 1
REG_REFRESH_HIVE = 2
REG_RESOURCE_LIST = 8
REG_RESOURCE_REQUIREMENTS_LIST = 10
REG_SZ = 1
REG_WHOLE_HIVE_VOLATILE = 1
def SaveKey(key, file_name):
    'SaveKey(key, file_name) - Saves the specified key, and all its subkeys to the specified file.\n\nkey is an already open key, or any one of the predefined HKEY_* constants.\nfile_name is the name of the file to save registry data to.\n This file cannot already exist. If this filename includes an extension,\n it cannot be used on file allocation table (FAT) file systems by the\n LoadKey(), ReplaceKey() or RestoreKey() methods.\n\nIf key represents a key on a remote computer, the path described by\nfile_name is relative to the remote computer.\nThe caller of this method must possess the SeBackupPrivilege security privilege.\nThis function passes NULL for security_attributes to the API.'
    pass

def SetValue(key, sub_key, type, value):
    'SetValue(key, sub_key, type, value) - Associates a value with a specified key.\n\nkey is an already open key, or any one of the predefined HKEY_* constants.\nsub_key is a string that names the subkey with which the value is associated.\ntype is an integer that specifies the type of the data.  Currently this\n must be REG_SZ, meaning only strings are supported.\nvalue is a string that specifies the new value.\n\nIf the key specified by the sub_key parameter does not exist, the SetValue\nfunction creates it.\n\nValue lengths are limited by available memory. Long values (more than\n2048 bytes) should be stored as files with the filenames stored in \nthe configuration registry.  This helps the registry perform efficiently.\n\nThe key identified by the key parameter must have been opened with\nKEY_SET_VALUE access.'
    pass

def SetValueEx(key, value_name, reserved, type, value):
    'SetValueEx(key, value_name, reserved, type, value) - Stores data in the value field of an open registry key.\n\nkey is an already open key, or any one of the predefined HKEY_* constants.\nvalue_name is a string containing the name of the value to set, or None\ntype is an integer that specifies the type of the data.  This should be one of:\n  REG_BINARY -- Binary data in any form.\n  REG_DWORD -- A 32-bit number.\n  REG_DWORD_LITTLE_ENDIAN -- A 32-bit number in little-endian format.\n  REG_DWORD_BIG_ENDIAN -- A 32-bit number in big-endian format.\n  REG_EXPAND_SZ -- A null-terminated string that contains unexpanded references\n                   to environment variables (for example, %PATH%).\n  REG_LINK -- A Unicode symbolic link.\n  REG_MULTI_SZ -- A sequence of null-terminated strings, terminated by\n                  two null characters.  Note that Python handles this\n                  termination automatically.\n  REG_NONE -- No defined value type.\n  REG_RESOURCE_LIST -- A device-driver resource list.\n  REG_SZ -- A null-terminated string.\nreserved can be anything - zero is always passed to the API.\nvalue is a string that specifies the new value.\n\nThis method can also set additional value and type information for the\nspecified key.  The key identified by the key parameter must have been\nopened with KEY_SET_VALUE access.\n\nTo open the key, use the CreateKeyEx() or OpenKeyEx() methods.\n\nValue lengths are limited by available memory. Long values (more than\n2048 bytes) should be stored as files with the filenames stored in \nthe configuration registry.  This helps the registry perform efficiently.'
    pass

__doc__ = 'This module provides access to the Windows registry API.\n\nFunctions:\n\nCloseKey() - Closes a registry key.\nConnectRegistry() - Establishes a connection to a predefined registry handle\n                    on another computer.\nCreateKey() - Creates the specified key, or opens it if it already exists.\nDeleteKey() - Deletes the specified key.\nDeleteValue() - Removes a named value from the specified registry key.\nEnumKey() - Enumerates subkeys of the specified open registry key.\nEnumValue() - Enumerates values of the specified open registry key.\nExpandEnvironmentStrings() - Expand the env strings in a REG_EXPAND_SZ string.\nFlushKey() - Writes all the attributes of the specified key to the registry.\nLoadKey() - Creates a subkey under HKEY_USER or HKEY_LOCAL_MACHINE and stores\n            registration information from a specified file into that subkey.\nOpenKey() - Alias for <om win32api.RegOpenKeyEx>\nOpenKeyEx() - Opens the specified key.\nQueryValue() - Retrieves the value associated with the unnamed value for a\n               specified key in the registry.\nQueryValueEx() - Retrieves the type and data for a specified value name\n                 associated with an open registry key.\nQueryInfoKey() - Returns information about the specified key.\nSaveKey() - Saves the specified key, and all its subkeys a file.\nSetValue() - Associates a value with a specified key.\nSetValueEx() - Stores data in the value field of an open registry key.\n\nSpecial objects:\n\nHKEYType -- type object for HKEY objects\nerror -- exception raised for Win32 errors\n\nInteger constants:\nMany constants are defined - see the documentation for each function\nto see what constants are used, and where.'
__name__ = '_winreg'
__package__ = None
error = exceptions.WindowsError
