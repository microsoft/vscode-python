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
fn list_windows_store_python_executables(
    environment: &dyn known::Environment,
) -> Option<Vec<PythonEnvironment>> {
    let mut python_envs: Vec<PythonEnvironment> = vec![];
    let home = environment.get_user_home()?;
    let apps_path = Path::new(&home)
        .join("AppData")
        .join("Local")
        .join("Microsoft")
        .join("WindowsApps");
    let hkcu = winreg::RegKey::predef(winreg::enums::HKEY_CURRENT_USER);
    for file in std::fs::read_dir(apps_path).ok()?.filter_map(Result::ok) {
        let path = file.path();
        if let Some(name) = path.file_name() {
            let exe = path.join("python.exe");
            if name
                .to_str()
                .unwrap_or_default()
                .starts_with("PythonSoftwareFoundation.Python.")
                && exe.is_file()
                && exe.exists()
            {
                if let Some(result) =
                    get_package_display_name_and_location(name.to_string_lossy().to_string(), &hkcu)
                {
                    let env = PythonEnvironment {
                        display_name: Some(result.display_name),
                        name: None,
                        python_executable_path: Some(exe.clone()),
                        version: None,
                        category: crate::messaging::PythonEnvironmentCategory::WindowsStore,
                        env_path: Some(PathBuf::from(result.env_path.clone())),
                        env_manager: None,
                        project_path: None,
                        python_run_command: Some(vec![exe.to_string_lossy().to_string()]),
                        arch: None,
                    };
                    python_envs.push(env);
                }
            }
        }
    }

    Some(python_envs)
}

#[cfg(windows)]
fn get_package_full_name_from_registry(name: String, hkcu: &RegKey) -> Option<String> {
    let key = format!("Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\CurrentVersion\\AppModel\\SystemAppData\\{}\\Schemas", name);
    let package_key = hkcu.open_subkey(key).ok()?;
    let value = package_key.get_value("PackageFullName").unwrap_or_default();
    Some(value)
}

#[derive(Debug)]
#[cfg(windows)]
struct StorePythonInfo {
    display_name: String,
    env_path: String,
}

#[cfg(windows)]
fn get_package_display_name_and_location(name: String, hkcu: &RegKey) -> Option<StorePythonInfo> {
    if let Some(name) = get_package_full_name_from_registry(name, &hkcu) {
        let key = format!("Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\CurrentVersion\\AppModel\\Repository\\Packages\\{}", name);
        let package_key = hkcu.open_subkey(key).ok()?;
        let display_name = package_key.get_value("DisplayName").ok()?;
        let env_path = package_key.get_value("PackageRootFolder").ok()?;

        return Some(StorePythonInfo {
            display_name,
            env_path,
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
                display_name: None,
                name: None,
                python_executable_path: Some(env.executable.clone()),
                version: None,
                category: crate::messaging::PythonEnvironmentCategory::WindowsStore,
                env_path: None,
                env_manager: None,
                project_path: None,
                python_run_command: Some(vec![env.executable.to_str().unwrap().to_string()]),
                arch: None,
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
