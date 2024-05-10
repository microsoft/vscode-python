// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

use std::{
    collections::{HashMap, HashSet},
    fs::DirEntry,
    io::Error,
    path::PathBuf,
};

use crate::{
    known::Environment,
    locator::Locator,
    messaging::{MessageDispatcher, PythonEnvironment},
    utils::PythonEnv,
};
use regex::Regex;

fn is_symlinked_python_executable(path: Result<DirEntry, Error>) -> Option<PathBuf> {
    let path = path.ok()?.path();
    let name = path.file_name()?.to_string_lossy();
    if !name.starts_with("python") || name.ends_with("-config") || name.ends_with("-build") {
        return None;
    }
    let metadata = std::fs::symlink_metadata(&path).ok()?;
    if metadata.is_file() || !metadata.file_type().is_symlink() {
        return None;
    }
    Some(std::fs::canonicalize(path).ok()?)
}

pub struct Homebrew<'a> {
    pub environments: HashMap<String, PythonEnvironment>,
    pub environment: &'a dyn Environment,
}

impl Homebrew<'_> {
    pub fn with<'a>(environment: &'a impl Environment) -> Homebrew {
        Homebrew {
            environments: HashMap::new(),
            environment,
        }
    }
}

impl Locator for Homebrew<'_> {
    fn is_known(&self, python_executable: &PathBuf) -> bool {
        self.environments
            .contains_key(python_executable.to_str().unwrap_or_default())
    }

    fn track_if_compatible(&mut self, _env: &PythonEnv) -> bool {
        // We will find everything in gather
        false
    }

    fn gather(&mut self) -> Option<()> {
        let homebrew_prefix = self
            .environment
            .get_env_var("HOMEBREW_PREFIX".to_string())?;
        let homebrew_prefix_bin = PathBuf::from(homebrew_prefix).join("bin");
        let mut reported: HashSet<String> = HashSet::new();
        let python_regex = Regex::new(r"/(\d+\.\d+\.\d+)/").unwrap();
        for file in std::fs::read_dir(homebrew_prefix_bin).ok()? {
            if let Some(exe) = is_symlinked_python_executable(file) {
                let python_version = exe.to_string_lossy().to_string();
                let version = match python_regex.captures(&python_version) {
                    Some(captures) => match captures.get(1) {
                        Some(version) => Some(version.as_str().to_string()),
                        None => None,
                    },
                    None => None,
                };
                if reported.contains(&exe.to_string_lossy().to_string()) {
                    continue;
                }
                reported.insert(exe.to_string_lossy().to_string());
                let env = crate::messaging::PythonEnvironment::new(
                    None,
                    Some(exe.clone()),
                    crate::messaging::PythonEnvironmentCategory::Homebrew,
                    version,
                    None,
                    None,
                    None,
                    Some(vec![exe.to_string_lossy().to_string()]),
                );
                self.environments
                    .insert(exe.to_string_lossy().to_string(), env);
            }
        }
        Some(())
    }

    fn report(&self, reporter: &mut dyn MessageDispatcher) {
        for env in self.environments.values() {
            reporter.report_environment(env.clone());
        }
    }
}
