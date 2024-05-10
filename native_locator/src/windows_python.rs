// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use crate::known;
use crate::known::Environment;
use crate::locator::Locator;
use crate::messaging::MessageDispatcher;
use crate::messaging::PythonEnvironment;
use crate::utils::PythonEnv;
use std::collections::HashMap;
use std::path::Path;
use std::path::PathBuf;

fn is_windows_python_executable(path: &PathBuf) -> bool {
    let name = path.file_name().unwrap().to_string_lossy().to_lowercase();
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

fn list_registry_pythons() -> Option<Vec<PathBuf>> {
    None
}

pub struct WindowsPython<'a> {
    pub environments: HashMap<String, PythonEnvironment>,
    pub environment: &'a dyn Environment,
}

impl WindowsPython<'_> {
    #[allow(dead_code)]
    pub fn with<'a>(environment: &'a impl Environment) -> WindowsPython {
        WindowsPython {
            environments: HashMap::new(),
            environment,
        }
    }
}

impl Locator for WindowsPython<'_> {
    fn is_known(&self, python_executable: &PathBuf) -> bool {
        self.environments
            .contains_key(python_executable.to_str().unwrap_or_default())
    }

    fn track_if_compatible(&mut self, env: &PythonEnv) -> bool {
        if is_windows_python_executable(&env.executable) {
            self.environments.insert(
                env.executable.to_str().unwrap().to_string(),
                PythonEnvironment {
                    name: None,
                    python_executable_path: Some(env.executable.clone()),
                    version: None,
                    category: crate::messaging::PythonEnvironmentCategory::WindowsStore,
                    sys_prefix_path: None,
                    env_path: None,
                    env_manager: None,
                    project_path: None,
                    python_run_command: Some(vec![env.executable.to_str().unwrap().to_string()]),
                },
            );
            return true;
        }
        false
    }

    fn gather(&mut self) -> Option<()> {
        if let Some(envs) = list_windows_store_python_executables(self.environment) {
            envs.iter().for_each(|env| {
                self.track_if_compatible(&&PythonEnv::from(env.clone()));
            });
        }
        if let Some(envs) = list_registry_pythons() {
            envs.iter().for_each(|env| {
                self.track_if_compatible(&&PythonEnv::from(env.clone()));
            });
        }
        Some(())
    }

    fn report(&self, reporter: &mut dyn MessageDispatcher) {
        for env in self.environments.values() {
            reporter.report_environment(env.clone());
        }
    }
}
