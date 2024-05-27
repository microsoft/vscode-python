// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

#[cfg(windows)]
use crate::known;
#[cfg(windows)]
use crate::known::Environment;
#[cfg(windows)]
use crate::locator::{Locator, LocatorResult};
#[cfg(windows)]
use crate::messaging::PythonEnvironment;
#[cfg(windows)]
use crate::utils::PythonEnv;
#[cfg(windows)]
use log::{trace, warn};
#[cfg(windows)]
use std::path::Path;
#[cfg(windows)]
use std::path::PathBuf;
#[cfg(windows)]
use winreg::RegKey;

#[cfg(windows)]
pub fn is_windows_python_executable(path: &PathBuf) -> bool {
    let name = path.file_name().unwrap().to_string_lossy().to_lowercase();
    // TODO: Is it safe to assume the number 3?
    name.starts_with("python3.") && name.ends_with(".exe")
}

#[cfg(windows)]
pub fn is_windows_app_folder_in_program_files(path: &PathBuf) -> bool {
    path.to_str().unwrap_or_default().to_string().to_lowercase()[1..].starts_with(":\\program files\\windowsapps")
}

#[cfg(windows)]
fn list_windows_store_python_executables(
    environment: &dyn known::Environment,
) -> Option<Vec<PythonEnvironment>> {
    use crate::messaging::Architecture;
    use regex::Regex;
    use std::collections::HashMap;

    let mut python_envs: Vec<PythonEnvironment> = vec![];
    let home = environment.get_user_home()?;
    let apps_path = Path::new(&home)
        .join("AppData")
        .join("Local")
        .join("Microsoft")
        .join("WindowsApps");
    let hkcu = winreg::RegKey::predef(winreg::enums::HKEY_CURRENT_USER);
    trace!("Searching for Windows Store Python in {:?}", apps_path);
    let folder_version_regex =
        Regex::new("PythonSoftwareFoundation.Python.(\\d+\\.\\d+)_.*").unwrap();
    let exe_version_regex = Regex::new("python(\\d+\\.\\d+).exe").unwrap();
    #[derive(Default)]
    struct PotentialPython {
        path: Option<PathBuf>,
        name: Option<String>,
        exe: Option<PathBuf>,
        version: String,
    }
    let mut potential_matches: HashMap<String, PotentialPython> = HashMap::new();
    for path in std::fs::read_dir(apps_path)
        .ok()?
        .filter_map(Result::ok)
        .map(|f| f.path())
    {
        if let Some(name) = path.file_name() {
            let name = name.to_string_lossy().to_string();
            if name.starts_with("PythonSoftwareFoundation.Python.") {
                let simple_version = folder_version_regex.captures(&name)?;
                let simple_version = simple_version
                    .get(1)
                    .map(|m| m.as_str())
                    .unwrap_or_default();
                if simple_version.len() == 0 {
                    continue;
                }
                if let Some(existing) = potential_matches.get_mut(&simple_version.to_string()) {
                    existing.path = Some(path.clone());
                    existing.name = Some(name.clone());
                } else {
                    let item = PotentialPython {
                        path: Some(path.clone()),
                        name: Some(name.clone()),
                        version: simple_version.to_string(),
                        ..Default::default()
                    };
                    potential_matches.insert(simple_version.to_string(), item);
                }
            } else if name.starts_with("python") && name.ends_with(".exe") {
                if name == "python.exe" || name == "python3.exe" {
                    // Unfortunately we have no idea what these point to.
                    // Even old python code didn't report these, hopefully users will not use these.
                    // If they do, we might have to spawn Python to find the real path and match it to one of the items discovered.
                    continue;
                }
                if let Some(simple_version) = exe_version_regex.captures(&name) {
                    let simple_version = simple_version
                        .get(1)
                        .map(|m| m.as_str())
                        .unwrap_or_default();
                    if simple_version.len() == 0 {
                        continue;
                    }
                    if let Some(existing) = potential_matches.get_mut(&simple_version.to_string()) {
                        existing.exe = Some(path.clone());
                    } else {
                        let item = PotentialPython {
                            exe: Some(path.clone()),
                            version: simple_version.to_string(),
                            ..Default::default()
                        };
                        potential_matches.insert(simple_version.to_string(), item);
                    }
                }
            }
        }
    }

    for (_, item) in potential_matches {
        if item.exe.is_none() {
            warn!(
                "Did not find a Windows Store exe for version {:?} that coresponds to path {:?}",
                item.version, item.path
            );
            continue;
        }
        if item.path.is_none() {
            warn!(
                "Did not find a Windows Store path for version {:?} that coresponds to exe {:?}",
                item.version, item.exe
            );
            continue;
        }
        let name = item.name.unwrap_or_default();
        let path = item.path.unwrap_or_default();
        let exe = item.exe.unwrap_or_default();
        let parent = path.parent()?.to_path_buf(); // This dir definitely exists.
        if let Some(result) = get_package_display_name_and_location(&name, &hkcu) {
            let env_path = PathBuf::from(result.env_path);
            let env = PythonEnvironment {
                display_name: Some(result.display_name),
                python_executable_path: Some(exe.clone()),
                category: crate::messaging::PythonEnvironmentCategory::WindowsStore,
                env_path: Some(env_path.clone()),
                python_run_command: Some(vec![exe.to_string_lossy().to_string()]),
                arch: if result.is64_bit {
                    Some(Architecture::X64)
                } else {
                    None
                },
                version: Some(item.version.clone()),
                symlinks: Some(vec![
                    parent.join(format!("python{:?}.exe", item.version)),
                    path.join("python.exe"),
                    path.join("python3.exe"),
                    path.join(format!("python{:?}.exe", item.version)),
                    env_path.join("python.exe"),
                    env_path.join(format!("python{:?}.exe", item.version)),
                ]),
                ..Default::default()
            };
            python_envs.push(env);
        } else {
            warn!(
                "Failed to get package display name & location for Windows Store Package {:?}",
                path
            );
        }
    }
    Some(python_envs)
}

#[cfg(windows)]
fn get_package_full_name_from_registry(name: &String, hkcu: &RegKey) -> Option<String> {
    let key = format!("Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\CurrentVersion\\AppModel\\SystemAppData\\{}\\Schemas", name);
    trace!("Opening registry key {:?}", key);
    let package_key = hkcu.open_subkey(key).ok()?;
    let value = package_key.get_value("PackageFullName").ok()?;
    Some(value)
}

#[derive(Debug)]
#[cfg(windows)]
struct StorePythonInfo {
    display_name: String,
    env_path: String,
    is64_bit: bool,
}

#[cfg(windows)]
fn get_package_display_name_and_location(name: &String, hkcu: &RegKey) -> Option<StorePythonInfo> {
    if let Some(name) = get_package_full_name_from_registry(name, &hkcu) {
        let key = format!("Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\CurrentVersion\\AppModel\\Repository\\Packages\\{}", name);
        trace!("Opening registry key {:?}", key);
        let package_key = hkcu.open_subkey(key).ok()?;
        let display_name = package_key.get_value("DisplayName").ok()?;
        let env_path = package_key.get_value("PackageRootFolder").ok()?;

        return Some(StorePythonInfo {
            display_name,
            env_path,
            is64_bit: name.contains("_x64_"),
        });
    }
    None
}

#[cfg(windows)]
pub struct WindowsStore<'a> {
    pub environment: &'a dyn Environment,
}

#[cfg(windows)]
impl WindowsStore<'_> {
    #[allow(dead_code)]
    pub fn with<'a>(environment: &'a impl Environment) -> WindowsStore {
        WindowsStore { environment }
    }
}

#[cfg(windows)]
impl Locator for WindowsStore<'_> {
    fn resolve(&self, env: &PythonEnv) -> Option<PythonEnvironment> {
        if is_windows_python_executable(&env.executable) {
            return Some(PythonEnvironment {
                python_executable_path: Some(env.executable.clone()),
                category: crate::messaging::PythonEnvironmentCategory::WindowsStore,
                python_run_command: Some(vec![env.executable.to_str().unwrap().to_string()]),
                ..Default::default()
            });
        }
        None
    }

    fn find(&mut self) -> Option<LocatorResult> {
        let environments = list_windows_store_python_executables(self.environment)?;

        if environments.is_empty() {
            None
        } else {
            Some(LocatorResult {
                managers: vec![],
                environments,
            })
        }
    }
}
