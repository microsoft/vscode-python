// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use crate::known;
use crate::known::Environment;
use crate::locator::{Locator, LocatorResult};
use crate::messaging::PythonEnvironment;
use crate::utils::PythonEnv;
use std::path::Path;
use std::path::PathBuf;

pub fn is_windows_python_executable(path: &PathBuf) -> bool {
    let name = path.file_name().unwrap().to_string_lossy().to_lowercase();
    // TODO: Is it safe to assume the number 3?
    name.starts_with("python3.") && name.ends_with(".exe")
}

fn list_windows_store_python_executables(
    environment: &dyn known::Environment,
) -> Option<Vec<PathBuf>> {
    let mut python_envs: Vec<PathBuf> = vec![];
    let home = environment.get_user_home()?;
    let apps_path = Path::new(&home)
        .join("AppData")
        .join("Local")
        .join("Microsoft")
        .join("WindowsApps");
    for file in std::fs::read_dir(apps_path).ok()? {
        match file {
            Ok(file) => {
                let path = file.path();
                if path.is_file() && is_windows_python_executable(&path) {
                    python_envs.push(path);
                }
            }
            Err(_) => {}
        }
    }

    Some(python_envs)
}

pub struct WindowsStore<'a> {
    pub environment: &'a dyn Environment,
}

impl WindowsStore<'_> {
    #[allow(dead_code)]
    pub fn with<'a>(environment: &'a impl Environment) -> WindowsStore {
        WindowsStore { environment }
    }
}

impl Locator for WindowsStore<'_> {
    fn resolve(&self, env: &PythonEnv) -> Option<PythonEnvironment> {
        if is_windows_python_executable(&env.executable) {
            return Some(PythonEnvironment {
                name: None,
                python_executable_path: Some(env.executable.clone()),
                version: None,
                category: crate::messaging::PythonEnvironmentCategory::WindowsStore,
                sys_prefix_path: None,
                env_path: None,
                env_manager: None,
                project_path: None,
                python_run_command: Some(vec![env.executable.to_str().unwrap().to_string()]),
            });
        }
        None
    }

    fn find(&mut self) -> Option<LocatorResult> {
        let mut environments: Vec<PythonEnvironment> = vec![];
        if let Some(envs) = list_windows_store_python_executables(self.environment) {
            envs.iter().for_each(|env| {
                if let Some(env) = self.resolve(&&PythonEnv::from(env.clone())) {
                    environments.push(env);
                }
            });
        }

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
