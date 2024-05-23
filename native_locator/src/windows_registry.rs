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
fn get_registry_pythons_from_key(
    hk: &RegKey,
    conda_locator: &mut dyn CondaLocator,
) -> Option<LocatorResult> {
    let mut environments = vec![];
    let mut managers: Vec<EnvManager> = vec![];
    let python_key = hk.open_subkey("Software\\Python").ok()?;
    for company in python_key.enum_keys().filter_map(Result::ok) {
        if let Some(result) =
            get_registry_pythons_from_key_for_company(&hk, &company, conda_locator)
        {
            managers.extend(result.managers);
            environments.extend(result.environments);
        }
    }

    Some(LocatorResult {
        environments,
        managers,
    })
}

#[cfg(windows)]
fn get_registry_pythons_from_key_for_company(
    hk: &RegKey,
    company: &str,
    conda_locator: &mut dyn CondaLocator,
) -> Option<LocatorResult> {
    use crate::messaging::Architecture;

    let mut environments = vec![];
    let mut managers: Vec<EnvManager> = vec![];
    let python_key = hk.open_subkey("Software\\Python").ok()?;
    let company_key = python_key.open_subkey(company).ok()?;
    let company_display_name: Option<String> = company_key.get_value("DisplayName").ok();
    for key in company_key.enum_keys().filter_map(Result::ok) {
        if let Some(key) = company_key.open_subkey(key).ok() {
            if let Some(install_path_key) = key.open_subkey("InstallPath").ok() {
                let env_path: String = install_path_key.get_value("").ok().unwrap_or_default();
                let env_path = PathBuf::from(env_path);

                // Possible this is a conda install folder.
                if let Some(conda_result) = conda_locator.find_in(&env_path) {
                    for manager in conda_result.managers {
                        let mut mgr = manager.clone();
                        mgr.company = Some(company.to_string());
                        mgr.company_display_name = company_display_name.clone();
                        managers.push(mgr)
                    }
                    for env in conda_result.environments {
                        let mut env = env.clone();
                        env.company = Some(company.to_string());
                        env.company_display_name = company_display_name.clone();
                        if let Some(mgr) = env.env_manager {
                            let mut mgr = mgr.clone();
                            mgr.company = Some(company.to_string());
                            mgr.company_display_name = company_display_name.clone();
                            env.env_manager = Some(mgr);
                        }
                        environments.push(env);
                    }
                    continue;
                }

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
                let architecture: String =
                    key.get_value("SysArchitecture").ok().unwrap_or_default();
                let display_name: String = key.get_value("DisplayName").ok().unwrap_or_default();

                let mut env = PythonEnvironment::new(
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
                    Some(vec![executable.to_string_lossy().to_string()]),
                );
                if architecture.contains("32") {
                    env.arch = Some(Architecture::X86);
                } else if architecture.contains("64") {
                    env.arch = Some(Architecture::X64);
                }
                env.company = Some(company.to_string());
                env.company_display_name = company_display_name.clone();
                environments.push(env);
            }
        }
    }

    Some(LocatorResult {
        environments,
        managers,
    })
}

#[cfg(windows)]
fn get_registry_pythons(conda_locator: &mut dyn CondaLocator) -> Option<LocatorResult> {
    let hklm = winreg::RegKey::predef(winreg::enums::HKEY_LOCAL_MACHINE);
    let hkcu = winreg::RegKey::predef(winreg::enums::HKEY_CURRENT_USER);

    let mut environments = vec![];
    let mut managers: Vec<EnvManager> = vec![];

    if let Some(result) = get_registry_pythons_from_key(&hklm, conda_locator) {
        managers.extend(result.managers);
        environments.extend(result.environments);
    }
    if let Some(result) = get_registry_pythons_from_key(&hkcu, conda_locator) {
        managers.extend(result.managers);
        environments.extend(result.environments);
    }
    Some(LocatorResult {
        environments,
        managers,
    })
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
        if let Some(result) = get_registry_pythons(self.conda_locator) {
            if !result.environments.is_empty() && !result.managers.is_empty() {
                return Some(result);
            }
        }
        None
    }
}
