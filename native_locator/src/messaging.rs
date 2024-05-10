// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use crate::logging::{LogLevel, LogMessage};
use env_logger::Builder;
use log::LevelFilter;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

pub trait MessageDispatcher {
    fn report_environment_manager(&mut self, env: EnvManager) -> ();
    fn report_environment(&mut self, env: PythonEnvironment) -> ();
    fn exit(&mut self) -> ();
}

#[derive(Serialize, Deserialize, Copy, Clone)]
#[serde(rename_all = "camelCase")]
pub enum EnvManagerType {
    Conda,
    Pyenv,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvManager {
    pub executable_path: PathBuf,
    pub version: Option<String>,
    pub tool: EnvManagerType,
}

impl EnvManager {
    pub fn new(executable_path: PathBuf, version: Option<String>, tool: EnvManagerType) -> Self {
        Self {
            executable_path,
            version,
            tool,
        }
    }
}

impl Clone for EnvManager {
    fn clone(&self) -> Self {
        Self {
            executable_path: self.executable_path.clone(),
            version: self.version.clone(),
            tool: self.tool.clone(),
        }
    }
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvManagerMessage {
    pub jsonrpc: String,
    pub method: String,
    pub params: EnvManager,
}

impl EnvManagerMessage {
    pub fn new(params: EnvManager) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            method: "envManager".to_string(),
            params,
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub enum PythonEnvironmentCategory {
    System,
    Homebrew,
    Conda,
    Pyenv,
    PyenvVirtualEnv,
    WindowsStore,
    Pipenv,
    VirtualEnvWrapper,
    Venv,
    VirtualEnv,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PythonEnvironment {
    pub name: Option<String>,
    pub python_executable_path: Option<PathBuf>,
    pub category: PythonEnvironmentCategory,
    pub version: Option<String>,
    pub env_path: Option<PathBuf>,
    pub sys_prefix_path: Option<PathBuf>,
    pub env_manager: Option<EnvManager>,
    pub python_run_command: Option<Vec<String>>,
    /**
     * The project path for the Pipenv environment.
     */
    pub project_path: Option<PathBuf>,
}

impl PythonEnvironment {
    pub fn new(
        name: Option<String>,
        python_executable_path: Option<PathBuf>,
        category: PythonEnvironmentCategory,
        version: Option<String>,
        env_path: Option<PathBuf>,
        sys_prefix_path: Option<PathBuf>,
        env_manager: Option<EnvManager>,
        python_run_command: Option<Vec<String>>,
    ) -> Self {
        Self {
            name,
            python_executable_path,
            category,
            version,
            env_path,
            sys_prefix_path,
            env_manager,
            python_run_command,
            project_path: None,
        }
    }
    pub fn new_pipenv(
        python_executable_path: Option<PathBuf>,
        version: Option<String>,
        env_path: Option<PathBuf>,
        sys_prefix_path: Option<PathBuf>,
        env_manager: Option<EnvManager>,
        project_path: PathBuf,
    ) -> Self {
        Self {
            name: None,
            python_executable_path: python_executable_path.clone(),
            category: PythonEnvironmentCategory::Pipenv,
            version,
            env_path,
            sys_prefix_path,
            env_manager,
            python_run_command: match python_executable_path {
                Some(exe) => Some(vec![exe.to_string_lossy().to_string()]),
                None => None,
            },
            project_path: Some(project_path),
        }
    }
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PythonEnvironmentMessage {
    pub jsonrpc: String,
    pub method: String,
    pub params: PythonEnvironment,
}

impl PythonEnvironmentMessage {
    pub fn new(params: PythonEnvironment) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            method: "pythonEnvironment".to_string(),
            params,
        }
    }
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExitMessage {
    pub jsonrpc: String,
    pub method: String,
    pub params: Option<()>,
}

impl ExitMessage {
    pub fn new() -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            method: "exit".to_string(),
            params: None,
        }
    }
}

pub struct JsonRpcDispatcher {}
pub fn send_message<T: serde::Serialize>(message: T) -> () {
    let message = serde_json::to_string(&message).unwrap();
    print!(
        "Content-Length: {}\r\nContent-Type: application/vscode-jsonrpc; charset=utf-8\r\n\r\n{}",
        message.len(),
        message
    );
}

pub fn initialize_logger(log_level: LevelFilter) {
    Builder::new()
        .format(|_, record| {
            let level = match record.level() {
                log::Level::Debug => LogLevel::Debug,
                log::Level::Error => LogLevel::Error,
                log::Level::Info => LogLevel::Info,
                log::Level::Warn => LogLevel::Warning,
                _ => LogLevel::Debug,
            };
            send_message(LogMessage::new(
                format!("{}", record.args()).to_string(),
                level,
            ));
            Ok(())
        })
        .filter(None, log_level)
        .init();
}
impl MessageDispatcher for JsonRpcDispatcher {
    fn report_environment_manager(&mut self, env: EnvManager) -> () {
        send_message(EnvManagerMessage::new(env));
    }
    fn report_environment(&mut self, env: PythonEnvironment) -> () {
        send_message(PythonEnvironmentMessage::new(env));
    }
    fn exit(&mut self) -> () {
        send_message(ExitMessage::new());
    }
}

pub fn create_dispatcher() -> JsonRpcDispatcher {
    JsonRpcDispatcher {}
}
