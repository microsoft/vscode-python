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
use crate::windows_store::is_windows_app_folder_in_program_files;
#[cfg(windows)]
use std::path::PathBuf;
#[cfg(windows)]
use winreg::RegKey;

#[cfg(windows)]
fn get_registry_pythons_from_key_for_company(
    key_container: &str,
    company_key: &RegKey,
    company: &str,
    conda_locator: &mut dyn CondaLocator,
) -> Option<LocatorResult> {
    use log::{trace, warn};

    use crate::messaging::Architecture;
    let mut managers: Vec<EnvManager> = vec![];
    let mut environments = vec![];
    let company_display_name: Option<String> = company_key.get_value("DisplayName").ok();
    for installed_python in company_key.enum_keys().filter_map(Result::ok) {
        match company_key.open_subkey(installed_python.clone()) {
            Ok(installed_python_key) => {
                match installed_python_key.open_subkey("InstallPath") {
                    Ok(install_path_key) => {
                        let env_path: String =
                            install_path_key.get_value("").ok().unwrap_or_default();
                        let env_path = PathBuf::from(env_path);
                        if is_windows_app_folder_in_program_files(&env_path) {
                            trace!(
                                "Found Python ({}) in {}\\Software\\Python\\{}\\{}, but skipping as this is a Windows Store Python",
                                env_path.to_str().unwrap_or_default(),
                                key_container,
                                company,
                                installed_python,
                            );
                            continue;
                        }
                        trace!(
                            "Found Python ({}) in {}\\Software\\Python\\{}\\{}",
                            env_path.to_str().unwrap_or_default(),
                            key_container,
                            company,
                            installed_python,
                        );

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
                            warn!(
                                "Executable is empty {}\\Software\\Python\\{}\\{}\\ExecutablePath",
                                key_container, company, installed_python
                            );
                            continue;
                        }
                        let executable = PathBuf::from(executable);
                        if !executable.exists() {
                            warn!(
                                "Python executable ({}) file not found for {}\\Software\\Python\\{}\\{}",
                                executable.to_str().unwrap_or_default(),
                                key_container,
                                company,
                                installed_python
                            );
                            continue;
                        }
                        let version: String = installed_python_key
                            .get_value("Version")
                            .ok()
                            .unwrap_or_default();
                        let architecture: String = installed_python_key
                            .get_value("SysArchitecture")
                            .ok()
                            .unwrap_or_default();
                        let display_name: String = installed_python_key
                            .get_value("DisplayName")
                            .ok()
                            .unwrap_or_default();

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
                    Err(err) => {
                        warn!(
                            "Failed to open {}\\Software\\Python\\{}\\{}\\InstallPath, {:?}",
                            key_container, company, installed_python, err
                        );
                    }
                }
            }
            Err(err) => {
                warn!(
                    "Failed to open {}\\Software\\Python\\{}\\{}, {:?}",
                    key_container, company, installed_python, err
                );
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
    use log::{trace, warn};

    let mut environments = vec![];
    let mut managers: Vec<EnvManager> = vec![];

    struct RegistryKey {
        pub name: &'static str,
        pub key: winreg::RegKey,
    }
    let search_keys = [
        RegistryKey {
            name: "HKLM",
            key: winreg::RegKey::predef(winreg::enums::HKEY_LOCAL_MACHINE),
        },
        RegistryKey {
            name: "HKCU",
            key: winreg::RegKey::predef(winreg::enums::HKEY_CURRENT_USER),
        },
    ];
    for (name, key) in search_keys.iter().map(|f| (f.name, &f.key)) {
        match key.open_subkey("Software\\Python") {
            Ok(python_key) => {
                for company in python_key.enum_keys().filter_map(Result::ok) {
                    trace!("Searching {}\\Software\\Python\\{}", name, company);
                    match python_key.open_subkey(&company) {
                        Ok(company_key) => {
                            if let Some(result) = get_registry_pythons_from_key_for_company(
                                name,
                                &company_key,
                                &company,
                                conda_locator,
                            ) {
                                managers.extend(result.managers);
                                environments.extend(result.environments);
                            }
                        }
                        Err(err) => {
                            warn!(
                                "Failed to open {}\\Software\\Python\\{}, {:?}",
                                name, company, err
                            );
                        }
                    }
                }
            }
            Err(err) => {
                warn!("Failed to open {}\\Software\\Python, {:?}", name, err)
            }
        }
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
            if !result.environments.is_empty() || !result.managers.is_empty() {
                return Some(result);
            }
        }
        None
    }
}
