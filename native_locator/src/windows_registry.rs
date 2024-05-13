// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

#[cfg(windows)]
use crate::locator::{Locator, LocatorResult};
#[cfg(windows)]
use crate::messaging::{PythonEnvironment, PythonEnvironmentCategory};
#[cfg(windows)]
use crate::utils::PythonEnv;
#[cfg(windows)]
use winreg::RegKey;
#[cfg(windows)]
use std::path::PathBuf;

#[cfg(windows)]
fn get_registry_pythons_from_key(hk: &RegKey, company: &str) -> Option<Vec<PythonEnvironment>> {
    let python_key = hk.open_subkey("Software\\Python").ok()?;
    let company_key = python_key.open_subkey(company).ok()?;

    let mut pythons = vec![];
    for key in company_key.enum_keys().filter_map(Result::ok) {
        let version_key = company_key.open_subkey(key).ok()?;
        let install_path_key = version_key.open_subkey("InstallPath").ok()?;
        let executable: String = install_path_key.get_value("ExecutablePath").ok()?;
        let version = version_key.get_value("Version").ok()?;

        let env = PythonEnvironment::new(
            None,
            Some(PathBuf::from(executable.clone())),
            PythonEnvironmentCategory::WindowsRegistry,
            Some(version),
            None,
            None,
            None,
            Some(vec![executable.clone()]),
        );

        pythons.push(env);
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
pub struct WindowsRegistry {}

#[cfg(windows)]
impl WindowsRegistry {
    #[allow(dead_code)]
    pub fn new() -> WindowsRegistry {
        WindowsRegistry {}
    }
}

#[cfg(windows)]
impl Locator for WindowsRegistry {
    fn resolve(&self, env: &PythonEnv) -> Option<PythonEnvironment> {
        None
    }

    fn find(&mut self) -> Option<LocatorResult> {
        let environments = get_registry_pythons("PythonCore")?;
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

// PythonCore
// ContinuumAnalytics
