// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

#[cfg(windows)]
use crate::conda::CondaLocator;
#[cfg(windows)]
use crate::locator::{Locator, LocatorResult};
#[cfg(windows)]
use crate::messaging::EnvManager;
#[cfg(windows)]
use crate::messaging::{PythonEnvironment, PythonEnvironmentCategory};
#[cfg(windows)]
use crate::utils::PythonEnv;
#[cfg(windows)]
use std::path::PathBuf;
#[cfg(windows)]
use winreg::RegKey;

#[cfg(windows)]
fn get_registry_pythons_from_key(hk: &RegKey, company: &str) -> Option<Vec<PythonEnvironment>> {
    let python_key = hk.open_subkey("Software\\Python").ok()?;
    let company_key = python_key.open_subkey(company).ok()?;

    let mut pythons = vec![];
    for key in company_key.enum_keys().filter_map(Result::ok) {
        if let Some(key) = company_key.open_subkey(key).ok() {
            if let Some(install_path_key) = key.open_subkey("InstallPath").ok() {
                let env_path: String = install_path_key.get_value("").ok().unwrap_or_default();
                let env_path = PathBuf::from(env_path);
                let env_path = if env_path.exists() {
                    Some(env_path)
                } else {
                    None
                };
                let executable: String = install_path_key
                    .get_value("ExecutablePath")
                    .ok()
                    .unwrap_or_default();
                if executable.len() == 0 {
                    continue;
                }
                let executable = PathBuf::from(executable);
                if !executable.exists() {
                    continue;
                }
                let version: String = key.get_value("Version").ok().unwrap_or_default();
                let display_name: String = key.get_value("DisplayName").ok().unwrap_or_default();

                let env = PythonEnvironment::new(
                    Some(display_name),
                    None,
                    Some(executable.clone()),
                    PythonEnvironmentCategory::WindowsRegistry,
                    if version.len() > 0 {
                        Some(version)
                    } else {
                        None
                    },
                    env_path,
                    None,
                    None,
                    Some(vec![executable.to_string_lossy().to_string()]),
                );
                pythons.push(env);
            }
        }
    }

    Some(pythons)
}

#[cfg(windows)]
pub fn get_registry_pythons(company: &str) -> Option<Vec<PythonEnvironment>> {
    let hklm = winreg::RegKey::predef(winreg::enums::HKEY_LOCAL_MACHINE);
    let hkcu = winreg::RegKey::predef(winreg::enums::HKEY_CURRENT_USER);

    let mut pythons = vec![];
    if let Some(hklm_pythons) = get_registry_pythons_from_key(&hklm, company) {
        pythons.extend(hklm_pythons);
    }
    if let Some(hkcu_pythons) = get_registry_pythons_from_key(&hkcu, company) {
        pythons.extend(hkcu_pythons);
    }
    Some(pythons)
}

#[cfg(windows)]
pub fn get_registry_pythons_anaconda(conda_locator: &mut dyn CondaLocator) -> LocatorResult {
    let hklm = winreg::RegKey::predef(winreg::enums::HKEY_LOCAL_MACHINE);
    let hkcu = winreg::RegKey::predef(winreg::enums::HKEY_CURRENT_USER);

    let mut pythons = vec![];
    if let Some(hklm_pythons) = get_registry_pythons_from_key(&hklm, "ContinuumAnalytics") {
        pythons.extend(hklm_pythons);
    }
    if let Some(hkcu_pythons) = get_registry_pythons_from_key(&hkcu, "ContinuumAnalytics") {
        pythons.extend(hkcu_pythons);
    }

    let mut environments: Vec<PythonEnvironment> = vec![];
    let mut managers: Vec<EnvManager> = vec![];

    for env in pythons.iter() {
        if let Some(env_path) = env.clone().env_path {
            if let Some(mut result) = conda_locator.find_in(&env_path) {
                environments.append(&mut result.environments);
                managers.append(&mut result.managers);
            }
        }
    }

    LocatorResult {
        managers,
        environments,
    }
}

#[cfg(windows)]
pub struct WindowsRegistry<'a> {
    pub conda_locator: &'a mut dyn CondaLocator,
}

#[cfg(windows)]
impl WindowsRegistry<'_> {
    #[allow(dead_code)]
    pub fn with<'a>(conda_locator: &'a mut impl CondaLocator) -> WindowsRegistry<'a> {
        WindowsRegistry { conda_locator }
    }
}

#[cfg(windows)]
impl Locator for WindowsRegistry<'_> {
    fn resolve(&self, _env: &PythonEnv) -> Option<PythonEnvironment> {
        None
    }

    fn find(&mut self) -> Option<LocatorResult> {
        let mut environments: Vec<PythonEnvironment> = vec![];
        let mut managers: Vec<EnvManager> = vec![];

        let mut result = get_registry_pythons("PythonCore").unwrap_or_default();
        environments.append(&mut result);

        let mut result = get_registry_pythons_anaconda(self.conda_locator) ;
        environments.append(&mut result.environments);
        managers.append(&mut result.managers);

        if environments.is_empty() && managers.is_empty() {
            None
        } else {
            Some(LocatorResult {
                managers,
                environments,
            })
        }
    }
}
