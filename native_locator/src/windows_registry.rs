// // Copyright (c) Microsoft Corporation. All rights reserved.
// // Licensed under the MIT License.
// use crate::messaging;
// use std::path::PathBuf;
// use winreg::RegKey;

// fn get_registry_pythons_from_key(
//     dispatcher: &mut impl messaging::MessageDispatcher,
//     hk: &RegKey,
//     company: &str,
// ) -> Option<Vec<PathBuf>> {
//     let python_key = hk.open_subkey("Software\\Python").ok()?;
//     let company_key = python_key.open_subkey(company).ok()?;

//     let mut pythons = vec![];
//     for key in company_key.enum_keys().filter_map(Result::ok) {
//         let version_key = company_key.open_subkey(key).ok()?;
//         let install_path_key = version_key.open_subkey("InstallPath").ok()?;
//         let executable: String = install_path_key.get_value("ExecutablePath").ok()?;
//         let version = version_key.get_value("Version").ok()?;

//         dispatcher.report_environment(messaging::PythonEnvironment::new(
//             None,
//             Some(PathBuf::from(executable.clone())),
//             messaging::PythonEnvironmentCategory::WindowsRegistry,
//             Some(version),
//             None,
//             None,
//             None,
//             None,
//         ));

//         pythons.push(PathBuf::from(executable));
//     }

//     Some(pythons)
// }

// #[cfg(windows)]
// pub fn report_and_get_registry_pythons(
//     dispatcher: &mut impl messaging::MessageDispatcher,
//     company: &str,
// ) -> Option<Vec<PathBuf>> {
//     let hklm = winreg::RegKey::predef(winreg::enums::HKEY_LOCAL_MACHINE);
//     let hkcu = winreg::RegKey::predef(winreg::enums::HKEY_CURRENT_USER);

//     let mut pythons = vec![];
//     if let Some(hklm_pythons) = get_registry_pythons_from_key(dispatcher, &hklm, company) {
//         pythons.extend(hklm_pythons);
//     }
//     if let Some(hkcu_pythons) = get_registry_pythons_from_key(dispatcher, &hkcu, company) {
//         pythons.extend(hkcu_pythons);
//     }

//     Some(pythons)
// }

// // PythonCore
// // ContinuumAnalytics
