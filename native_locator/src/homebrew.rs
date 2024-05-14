// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

use crate::{
    known::Environment,
    locator::{Locator, LocatorResult},
    messaging::PythonEnvironment,
    utils::PythonEnv,
};
use regex::Regex;
use std::{collections::HashSet, fs::DirEntry, io::Error, path::PathBuf};

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
    pub environment: &'a dyn Environment,
}

impl Homebrew<'_> {
    pub fn with<'a>(environment: &'a impl Environment) -> Homebrew {
        Homebrew { environment }
    }
}

impl Locator for Homebrew<'_> {
    fn resolve(&self, _env: &PythonEnv) -> Option<PythonEnvironment> {
        None
    }

    fn find(&mut self) -> Option<LocatorResult> {
        let homebrew_prefix = self
            .environment
            .get_env_var("HOMEBREW_PREFIX".to_string())?;
        let homebrew_prefix_bin = PathBuf::from(homebrew_prefix).join("bin");
        let mut reported: HashSet<String> = HashSet::new();
        let python_regex = Regex::new(r"/(\d+\.\d+\.\d+)/").unwrap();
        let mut environments: Vec<PythonEnvironment> = vec![];
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
                    None,
                    Some(exe.clone()),
                    crate::messaging::PythonEnvironmentCategory::Homebrew,
                    version,
                    None,
                    None,
                    None,
                    Some(vec![exe.to_string_lossy().to_string()]),
                );
                environments.push(env);
            }
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
