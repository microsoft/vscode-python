import builtins

def CloseKey(hkey):
    'Closes a previously opened registry key.\n\n  hkey\n    A previously opened key.\n\nNote that if the key is not closed using this method, it will be\nclosed when the hkey object is destroyed by Python.'
    pass

def ConnectRegistry(computer_name, key):
    'Establishes a connection to the registry on another computer.\n\n  computer_name\n    The name of the remote computer, of the form r"\\\\computername".  If\n    None, the local computer is used.\n  key\n    The predefined key to connect to.\n\nThe return value is the handle of the opened key.\nIf the function fails, an OSError exception is raised.'
    pass

def CreateKey(key, sub_key):
    'Creates or opens the specified key.\n\n  key\n    An already open key, or one of the predefined HKEY_* constants.\n  sub_key\n    The name of the key this method opens or creates.\n\nIf key is one of the predefined keys, sub_key may be None. In that case,\nthe handle returned is the same key handle passed in to the function.\n\nIf the key already exists, this function opens the existing key.\n\nThe return value is the handle of the opened key.\nIf the function fails, an OSError exception is raised.'
    pass

def CreateKeyEx(key, sub_key, reserved, access):
    'Creates or opens the specified key.\n\n  key\n    An already open key, or one of the predefined HKEY_* constants.\n  sub_key\n    The name of the key this method opens or creates.\n  reserved\n    A reserved integer, and must be zero.  Default is zero.\n  access\n    An integer that specifies an access mask that describes the\n    desired security access for the key. Default is KEY_WRITE.\n\nIf key is one of the predefined keys, sub_key may be None. In that case,\nthe handle returned is the same key handle passed in to the function.\n\nIf the key already exists, this function opens the existing key\n\nThe return value is the handle of the opened key.\nIf the function fails, an OSError exception is raised.'
    pass

def DeleteKey(key, sub_key):
    'Deletes the specified key.\n\n  key\n    An already open key, or any one of the predefined HKEY_* constants.\n  sub_key\n    A string that must be the name of a subkey of the key identified by\n    the key parameter. This value must not be None, and the key may not\n    have subkeys.\n\nThis method can not delete keys with subkeys.\n\nIf the function succeeds, the entire key, including all of its values,\nis removed.  If the function fails, an OSError exception is raised.'
    pass

def DeleteKeyEx(key, sub_key, access, reserved):
    'Deletes the specified key (64-bit OS only).\n\n  key\n    An already open key, or any one of the predefined HKEY_* constants.\n  sub_key\n    A string that must be the name of a subkey of the key identified by\n    the key parameter. This value must not be None, and the key may not\n    have subkeys.\n  access\n    An integer that specifies an access mask that describes the\n    desired security access for the key. Default is KEY_WOW64_64KEY.\n  reserved\n    A reserved integer, and must be zero.  Default is zero.\n\nThis method can not delete keys with subkeys.\n\nIf the function succeeds, the entire key, including all of its values,\nis removed.  If the function fails, an OSError exception is raised.\nOn unsupported Windows versions, NotImplementedError is raised.'
    pass

def DeleteValue(key, value):
    'Removes a named value from a registry key.\n\n  key\n    An already open key, or any one of the predefined HKEY_* constants.\n  value\n    A string that identifies the value to remove.'
    pass

def DisableReflectionKey(key):
    'Disables registry reflection for 32bit processes running on a 64bit OS.\n\n  key\n    An already open key, or any one of the predefined HKEY_* constants.\n\nWill generally raise NotImplemented if executed on a 32bit OS.\n\nIf the key is not on the reflection list, the function succeeds but has\nno effect.  Disabling reflection for a key does not affect reflection\nof any subkeys.'
    pass

def EnableReflectionKey(key):
    'Restores registry reflection for the specified disabled key.\n\n  key\n    An already open key, or any one of the predefined HKEY_* constants.\n\nWill generally raise NotImplemented if executed on a 32bit OS.\nRestoring reflection for a key does not affect reflection of any\nsubkeys.'
    pass

def EnumKey(key, index):
    'Enumerates subkeys of an open registry key.\n\n  key\n    An already open key, or any one of the predefined HKEY_* constants.\n  index\n    An integer that identifies the index of the key to retrieve.\n\nThe function retrieves the name of one subkey each time it is called.\nIt is typically called repeatedly until an OSError exception is\nraised, indicating no more values are available.'
    pass

def EnumValue(key, index):
    'Enumerates values of an open registry key.\n\n  key\n    An already open key, or any one of the predefined HKEY_* constants.\n  index\n    An integer that identifies the index of the value to retrieve.\n\nThe function retrieves the name of one subkey each time it is called.\nIt is typically called repeatedly, until an OSError exception\nis raised, indicating no more values.\n\nThe result is a tuple of 3 items:\n  value_name\n    A string that identifies the value.\n  value_data\n    An object that holds the value data, and whose type depends\n    on the underlying registry type.\n  data_type\n    An integer that identifies the type of the value data.'
    pass

def ExpandEnvironmentStrings(string):
    'Expand environment vars.'
    pass

def FlushKey(key):
    "Writes all the attributes of a key to the registry.\n\n  key\n    An already open key, or any one of the predefined HKEY_* constants.\n\nIt is not necessary to call FlushKey to change a key.  Registry changes\nare flushed to disk by the registry using its lazy flusher.  Registry\nchanges are also flushed to disk at system shutdown.  Unlike\nCloseKey(), the FlushKey() method returns only when all the data has\nbeen written to the registry.\n\nAn application should only call FlushKey() if it requires absolute\ncertainty that registry changes are on disk.  If you don't know whether\na FlushKey() call is required, it probably isn't."
    pass

HKEYType = builtins.PyHKEY
HKEY_CLASSES_ROOT = 18446744071562067968
HKEY_CURRENT_CONFIG = 18446744071562067973
HKEY_CURRENT_USER = 18446744071562067969
HKEY_DYN_DATA = 18446744071562067974
HKEY_LOCAL_MACHINE = 18446744071562067970
HKEY_PERFORMANCE_DATA = 18446744071562067972
HKEY_USERS = 18446744071562067971
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
    'Insert data into the registry from a file.\n\n  key\n    An already open key, or any one of the predefined HKEY_* constants.\n  sub_key\n    A string that identifies the sub-key to load.\n  file_name\n    The name of the file to load registry data from.  This file must\n    have been created with the SaveKey() function.  Under the file\n    allocation table (FAT) file system, the filename may not have an\n    extension.\n\nCreates a subkey under the specified key and stores registration\ninformation from a specified file into that subkey.\n\nA call to LoadKey() fails if the calling process does not have the\nSE_RESTORE_PRIVILEGE privilege.\n\nIf key is a handle returned by ConnectRegistry(), then the path\nspecified in fileName is relative to the remote computer.\n\nThe MSDN docs imply key must be in the HKEY_USER or HKEY_LOCAL_MACHINE\ntree.'
    pass

def OpenKey(key, sub_key, reserved, access):
    'Opens the specified key.\n\n  key\n    An already open key, or any one of the predefined HKEY_* constants.\n  sub_key\n    A string that identifies the sub_key to open.\n  reserved\n    A reserved integer that must be zero.  Default is zero.\n  access\n    An integer that specifies an access mask that describes the desired\n    security access for the key.  Default is KEY_READ.\n\nThe result is a new handle to the specified key.\nIf the function fails, an OSError exception is raised.'
    pass

def OpenKeyEx(key, sub_key, reserved, access):
    'Opens the specified key.\n\n  key\n    An already open key, or any one of the predefined HKEY_* constants.\n  sub_key\n    A string that identifies the sub_key to open.\n  reserved\n    A reserved integer that must be zero.  Default is zero.\n  access\n    An integer that specifies an access mask that describes the desired\n    security access for the key.  Default is KEY_READ.\n\nThe result is a new handle to the specified key.\nIf the function fails, an OSError exception is raised.'
    pass

def QueryInfoKey(key):
    "Returns information about a key.\n\n  key\n    An already open key, or any one of the predefined HKEY_* constants.\n\nThe result is a tuple of 3 items:\nAn integer that identifies the number of sub keys this key has.\nAn integer that identifies the number of values this key has.\nAn integer that identifies when the key was last modified (if available)\nas 100's of nanoseconds since Jan 1, 1600."
    pass

def QueryReflectionKey(key):
    'Returns the reflection state for the specified key as a bool.\n\n  key\n    An already open key, or any one of the predefined HKEY_* constants.\n\nWill generally raise NotImplemented if executed on a 32bit OS.'
    pass

def QueryValue(key, sub_key):
    "Retrieves the unnamed value for a key.\n\n  key\n    An already open key, or any one of the predefined HKEY_* constants.\n  sub_key\n    A string that holds the name of the subkey with which the value\n    is associated.  If this parameter is None or empty, the function\n    retrieves the value set by the SetValue() method for the key\n    identified by key.\n\nValues in the registry have name, type, and data components. This method\nretrieves the data for a key's first value that has a NULL name.\nBut since the underlying API call doesn't return the type, you'll\nprobably be happier using QueryValueEx; this function is just here for\ncompleteness."
    pass

def QueryValueEx(key, name):
    'Retrieves the type and value of a specified sub-key.\n\n  key\n    An already open key, or any one of the predefined HKEY_* constants.\n  name\n    A string indicating the value to query.\n\nBehaves mostly like QueryValue(), but also returns the type of the\nspecified value name associated with the given open registry key.\n\nThe return value is a tuple of the value and the type_id.'
    pass

REG_BINARY = 3
REG_CREATED_NEW_KEY = 1
REG_DWORD = 4
REG_DWORD_BIG_ENDIAN = 5
REG_DWORD_LITTLE_ENDIAN = 4
REG_EXPAND_SZ = 2
REG_FULL_RESOURCE_DESCRIPTOR = 9
REG_LEGAL_CHANGE_FILTER = 268435471
REG_LEGAL_OPTION = 31
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
REG_QWORD = 11
REG_QWORD_LITTLE_ENDIAN = 11
REG_REFRESH_HIVE = 2
REG_RESOURCE_LIST = 8
REG_RESOURCE_REQUIREMENTS_LIST = 10
REG_SZ = 1
REG_WHOLE_HIVE_VOLATILE = 1
def SaveKey(key, file_name):
    'Saves the specified key, and all its subkeys to the specified file.\n\n  key\n    An already open key, or any one of the predefined HKEY_* constants.\n  file_name\n    The name of the file to save registry data to.  This file cannot\n    already exist. If this filename includes an extension, it cannot be\n    used on file allocation table (FAT) file systems by the LoadKey(),\n    ReplaceKey() or RestoreKey() methods.\n\nIf key represents a key on a remote computer, the path described by\nfile_name is relative to the remote computer.\n\nThe caller of this method must possess the SeBackupPrivilege\nsecurity privilege.  This function passes NULL for security_attributes\nto the API.'
    pass

def SetValue(key, sub_key, type, value):
    'Associates a value with a specified key.\n\n  key\n    An already open key, or any one of the predefined HKEY_* constants.\n  sub_key\n    A string that names the subkey with which the value is associated.\n  type\n    An integer that specifies the type of the data.  Currently this must\n    be REG_SZ, meaning only strings are supported.\n  value\n    A string that specifies the new value.\n\nIf the key specified by the sub_key parameter does not exist, the\nSetValue function creates it.\n\nValue lengths are limited by available memory. Long values (more than\n2048 bytes) should be stored as files with the filenames stored in\nthe configuration registry to help the registry perform efficiently.\n\nThe key identified by the key parameter must have been opened with\nKEY_SET_VALUE access.'
    pass

def SetValueEx(key, value_name, reserved, type, value):
    'Stores data in the value field of an open registry key.\n\n  key\n    An already open key, or any one of the predefined HKEY_* constants.\n  value_name\n    A string containing the name of the value to set, or None.\n  reserved\n    Can be anything - zero is always passed to the API.\n  type\n    An integer that specifies the type of the data, one of:\n    REG_BINARY -- Binary data in any form.\n    REG_DWORD -- A 32-bit number.\n    REG_DWORD_LITTLE_ENDIAN -- A 32-bit number in little-endian format. Equivalent to REG_DWORD\n    REG_DWORD_BIG_ENDIAN -- A 32-bit number in big-endian format.\n    REG_EXPAND_SZ -- A null-terminated string that contains unexpanded\n                     references to environment variables (for example,\n                     %PATH%).\n    REG_LINK -- A Unicode symbolic link.\n    REG_MULTI_SZ -- A sequence of null-terminated strings, terminated\n                    by two null characters.  Note that Python handles\n                    this termination automatically.\n    REG_NONE -- No defined value type.\n    REG_QWORD -- A 64-bit number.\n    REG_QWORD_LITTLE_ENDIAN -- A 64-bit number in little-endian format. Equivalent to REG_QWORD.\n    REG_RESOURCE_LIST -- A device-driver resource list.\n    REG_SZ -- A null-terminated string.\n  value\n    A string that specifies the new value.\n\nThis method can also set additional value and type information for the\nspecified key.  The key identified by the key parameter must have been\nopened with KEY_SET_VALUE access.\n\nTo open the key, use the CreateKeyEx() or OpenKeyEx() methods.\n\nValue lengths are limited by available memory. Long values (more than\n2048 bytes) should be stored as files with the filenames stored in\nthe configuration registry to help the registry perform efficiently.'
    pass

__doc__ = 'This module provides access to the Windows registry API.\n\nFunctions:\n\nCloseKey() - Closes a registry key.\nConnectRegistry() - Establishes a connection to a predefined registry handle\n                    on another computer.\nCreateKey() - Creates the specified key, or opens it if it already exists.\nDeleteKey() - Deletes the specified key.\nDeleteValue() - Removes a named value from the specified registry key.\nEnumKey() - Enumerates subkeys of the specified open registry key.\nEnumValue() - Enumerates values of the specified open registry key.\nExpandEnvironmentStrings() - Expand the env strings in a REG_EXPAND_SZ\n                             string.\nFlushKey() - Writes all the attributes of the specified key to the registry.\nLoadKey() - Creates a subkey under HKEY_USER or HKEY_LOCAL_MACHINE and\n            stores registration information from a specified file into that\n            subkey.\nOpenKey() - Opens the specified key.\nOpenKeyEx() - Alias of OpenKey().\nQueryValue() - Retrieves the value associated with the unnamed value for a\n               specified key in the registry.\nQueryValueEx() - Retrieves the type and data for a specified value name\n                 associated with an open registry key.\nQueryInfoKey() - Returns information about the specified key.\nSaveKey() - Saves the specified key, and all its subkeys a file.\nSetValue() - Associates a value with a specified key.\nSetValueEx() - Stores data in the value field of an open registry key.\n\nSpecial objects:\n\nHKEYType -- type object for HKEY objects\nerror -- exception raised for Win32 errors\n\nInteger constants:\nMany constants are defined - see the documentation for each function\nto see what constants are used, and where.'
__name__ = 'winreg'
__package__ = ''
error = builtins.OSError
