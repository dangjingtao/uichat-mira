#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::{Path, PathBuf};
#[cfg(not(debug_assertions))]
use std::process::Command;
#[cfg(all(windows, not(debug_assertions)))]
use std::os::windows::process::CommandExt;
#[cfg(not(debug_assertions))]
use std::sync::Mutex;
use std::sync::OnceLock;
#[cfg(not(debug_assertions))]
use uuid::Uuid;
use regex::Regex;
use serde_json::Value;
use tauri::Manager;
#[cfg(not(debug_assertions))]
use tauri::{RunEvent, WindowEvent};

#[cfg(not(debug_assertions))]
struct BackendProcess(Mutex<Option<std::process::Child>>);

#[cfg(all(windows, not(debug_assertions)))]
const CREATE_NO_WINDOW: u32 = 0x08000000;
#[cfg(not(debug_assertions))]
fn stop_backend_process<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    let backend_process = app.state::<BackendProcess>();
    let mut process_guard = backend_process.0.lock().unwrap();

    if let Some(mut child) = process_guard.take() {
        match child.try_wait() {
            Ok(Some(_status)) => {
                return;
            }
            Ok(None) => {}
            Err(error) => {
                eprintln!("Failed to query backend process state: {}", error);
            }
        }

        if let Err(error) = child.kill() {
            eprintln!("Failed to stop backend process: {}", error);
            return;
        }

        if let Err(error) = child.wait() {
            eprintln!("Failed to wait for backend process shutdown: {}", error);
        }
    }
}

#[cfg(not(debug_assertions))]
fn ensure_secret_file(secret_path: &Path, secret_name: &str) -> Result<String, String> {
    if secret_path.exists() {
        let secret = std::fs::read_to_string(secret_path)
            .map_err(|error| format!("Failed to read {} {:?}: {}", secret_name, secret_path, error))?;
        let secret = secret.trim().to_string();

        if !secret.is_empty() {
            return Ok(secret);
        }
    }

    if let Some(parent) = secret_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create {} directory {:?}: {}", secret_name, parent, error))?;
    }

    let secret = Uuid::new_v4().to_string();
    std::fs::write(secret_path, &secret)
        .map_err(|error| format!("Failed to write {} {:?}: {}", secret_name, secret_path, error))?;

    Ok(secret)
}

#[derive(Clone, Debug)]
struct RuntimeConfig {
    backend_host: String,
    backend_port: u16,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopRuntimePayload {
    host_kind: &'static str,
    platform: &'static str,
    is_packaged: bool,
    backend_url: String,
}

static RUNTIME_CONFIG: OnceLock<RuntimeConfig> = OnceLock::new();

#[derive(serde::Serialize, serde::Deserialize)]
struct HealthCheckResult {
    success: bool,
    #[serde(rename = "statusCode")]
    status_code: u16,
    error: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct DatabaseHealthResult {
    success: bool,
    ok: bool,
    configured: bool,
    mode: String,
    detail: String,
    #[serde(rename = "vectorStore")]
    vector_store: VectorStoreInfo,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct VectorStoreInfo {
    ok: bool,
    provider: String,
    detail: String,
    #[serde(rename = "extensionPath")]
    extension_path: Option<String>,
}

#[cfg(not(debug_assertions))]
fn get_packaged_resources_root() -> PathBuf {
    let mut exe_path = std::env::current_exe()
        .expect("Failed to get current exe path");
    exe_path.pop();
    exe_path.join("resources")
}

#[cfg(not(debug_assertions))]
fn get_resource_path() -> PathBuf {
    get_packaged_resources_root().join("server")
}

fn get_runtime_config() -> &'static RuntimeConfig {
    RUNTIME_CONFIG.get_or_init(|| {
        load_runtime_config().unwrap_or_else(|error| {
            panic!("Failed to load runtime.config.cjs: {}", error);
        })
    })
}

fn load_runtime_config() -> Result<RuntimeConfig, String> {
    let config_path = runtime_config_candidates()
        .into_iter()
        .find(|candidate| candidate.exists())
        .ok_or_else(|| "Unable to locate runtime.config.cjs".to_string())?;

    let contents = std::fs::read_to_string(&config_path)
        .map_err(|error| format!("Failed to read {:?}: {}", config_path, error))?;

    parse_runtime_config(&contents)
}

fn runtime_config_candidates() -> Vec<PathBuf> {
    #[cfg(debug_assertions)]
    {
        vec![
            PathBuf::from("..").join("runtime.config.cjs"),
            PathBuf::from("runtime.config.cjs"),
        ]
    }

    #[cfg(not(debug_assertions))]
    {
        let resources_root = get_packaged_resources_root();
        let resources_parent = resources_root
            .parent()
            .map(PathBuf::from)
            .unwrap_or_else(|| resources_root.clone());

        vec![
            resources_root.join("runtime.config.cjs"),
            resources_parent.join("runtime.config.cjs"),
        ]
    }
}

fn parse_runtime_config(contents: &str) -> Result<RuntimeConfig, String> {
    let host_regex = Regex::new(r#"host\s*:\s*"([^"]+)""#)
        .map_err(|error| format!("Failed to compile host regex: {}", error))?;
    let port_regex = Regex::new(
        r#"backend\s*:\s*\{[\s\S]*?port\s*:\s*(?:readPort\("[^"]+"\s*,\s*)?(\d+)"#,
    )
        .map_err(|error| format!("Failed to compile port regex: {}", error))?;

    let backend_host = host_regex
        .captures(contents)
        .and_then(|capture| capture.get(1))
        .map(|value| value.as_str().to_string())
        .ok_or_else(|| "backend.host is missing from runtime.config.cjs".to_string())?;

    let backend_port = port_regex
        .captures(contents)
        .and_then(|capture| capture.get(1))
        .and_then(|value| value.as_str().parse::<u16>().ok())
        .ok_or_else(|| "backend.port is missing from runtime.config.cjs".to_string())?;

    Ok(RuntimeConfig {
        backend_host,
        backend_port,
    })
}

fn get_backend_url() -> String {
    if let Ok(backend_url) = std::env::var("UI_CHAT_BACKEND_URL") {
        if !backend_url.trim().is_empty() {
            return backend_url;
        }
    }

    let runtime_config = get_runtime_config();

    format!(
        "http://{}:{}",
        runtime_config.backend_host, runtime_config.backend_port
    )
}

fn desktop_runtime_payload() -> DesktopRuntimePayload {
    DesktopRuntimePayload {
        host_kind: "tauri",
        platform: std::env::consts::OS,
        is_packaged: !cfg!(debug_assertions),
        backend_url: get_backend_url(),
    }
}

fn desktop_runtime_initialization_script() -> String {
    let payload = serde_json::to_string(&desktop_runtime_payload())
        .expect("Failed to serialize desktop runtime payload");

    format!(
        r#"
          Object.defineProperty(window, "desktopRuntime", {{
            value: {payload},
            configurable: false,
            writable: false
          }});
        "#
    )
}

async fn check_backend_health(token: Option<String>) -> Result<HealthCheckResult, String> {
    let client = reqwest::Client::new();
    let mut request = client.get(&format!("{}/health", get_backend_url()));

    if let Some(token) = token {
        if !token.trim().is_empty() {
            request = request.header("Authorization", format!("Bearer {}", token.trim()));
        }
    }

    match request.send().await {
        Ok(response) => {
            let status = response.status().as_u16();
            match response.json::<Value>().await {
                Ok(payload) => {
                    if status == 200 {
                        Ok(HealthCheckResult {
                            success: true,
                            status_code: status,
                            error: None,
                        })
                    } else {
                        Ok(HealthCheckResult {
                            success: false,
                            status_code: status,
                            error: Some(payload["message"].as_str().unwrap_or("Unknown error").to_string()),
                        })
                    }
                }
                Err(e) => Ok(HealthCheckResult {
                    success: false,
                    status_code: status,
                    error: Some(e.to_string()),
                })
            }
        }
        Err(e) => Ok(HealthCheckResult {
            success: false,
            status_code: 0,
            error: Some(e.to_string()),
        })
    }
}

async fn check_database_health(token: Option<String>) -> Result<DatabaseHealthResult, String> {
    let client = reqwest::Client::new();
    let mut request = client.get(&format!("{}/db/health", get_backend_url()));

    if let Some(token) = token {
        if !token.trim().is_empty() {
            request = request.header("Authorization", format!("Bearer {}", token.trim()));
        }
    }

    match request.send().await {
        Ok(response) => {
            match response.json::<Value>().await {
                Ok(payload) => {
                    if payload["success"].as_bool().unwrap_or(false) {
                        let data = payload["data"].as_object().unwrap();
                        let vector_store = data["vectorStore"].as_object().unwrap();
                        Ok(DatabaseHealthResult {
                            success: true,
                            ok: data["ok"].as_bool().unwrap_or(false),
                            configured: data["configured"].as_bool().unwrap_or(false),
                            mode: data["mode"].as_str().unwrap_or("unknown").to_string(),
                            detail: data["detail"].as_str().unwrap_or("").to_string(),
                            vector_store: VectorStoreInfo {
                                ok: vector_store["ok"].as_bool().unwrap_or(false),
                                provider: vector_store["provider"].as_str().unwrap_or("sqlite-vec").to_string(),
                                detail: vector_store["detail"].as_str().unwrap_or("").to_string(),
                                extension_path: vector_store["extensionPath"].as_str().map(|s| s.to_string()),
                            },
                        })
                    } else {
                        Ok(DatabaseHealthResult {
                            success: false,
                            ok: false,
                            configured: false,
                            mode: "unknown".to_string(),
                            detail: payload["message"].as_str().unwrap_or("Health check failed").to_string(),
                            vector_store: VectorStoreInfo {
                                ok: false,
                                provider: "sqlite-vec".to_string(),
                                detail: payload["message"].as_str().unwrap_or("Health check failed").to_string(),
                                extension_path: None,
                            },
                        })
                    }
                }
                Err(e) => Ok(DatabaseHealthResult {
                    success: false,
                    ok: false,
                    configured: false,
                    mode: "unknown".to_string(),
                    detail: e.to_string(),
                    vector_store: VectorStoreInfo {
                        ok: false,
                        provider: "sqlite-vec".to_string(),
                        detail: e.to_string(),
                        extension_path: None,
                    },
                })
            }
        }
        Err(e) => Ok(DatabaseHealthResult {
            success: false,
            ok: false,
            configured: false,
            mode: "unknown".to_string(),
            detail: e.to_string(),
            vector_store: VectorStoreInfo {
                ok: false,
                provider: "sqlite-vec".to_string(),
                detail: e.to_string(),
                extension_path: None,
            },
        })
    }
}

#[tauri::command]
fn get_backend_url_command() -> String {
    get_backend_url()
}

fn get_browser_extension_source_path() -> PathBuf {
    #[cfg(debug_assertions)]
    {
        return PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("mira-clipper-ext")
            .join("dist")
            .join("dev")
            .join("Chujie.crx");
    }

    #[cfg(not(debug_assertions))]
    {
        get_packaged_resources_root()
            .join("browser-extension")
            .join("Chujie.crx")
    }
}

fn available_download_path(downloads_dir: &Path) -> PathBuf {
    let base_name = "Chujie";
    let mut candidate = downloads_dir.join(format!("{base_name}.crx"));
    let mut suffix = 1;
    while candidate.exists() {
        candidate = downloads_dir.join(format!("{base_name} ({suffix}).crx"));
        suffix += 1;
    }
    candidate
}

#[tauri::command]
fn download_browser_extension_command(app: tauri::AppHandle) -> Result<String, String> {
    let source_path = get_browser_extension_source_path();
    if !source_path.exists() {
        return Err(format!("Browser extension package not found: {:?}", source_path));
    }

    let downloads_dir = app
        .path()
        .download_dir()
        .map_err(|error| format!("Failed to resolve Downloads directory: {error}"))?;
    std::fs::create_dir_all(&downloads_dir)
        .map_err(|error| format!("Failed to create Downloads directory: {error}"))?;
    let destination_path = available_download_path(&downloads_dir);
    std::fs::copy(&source_path, &destination_path)
        .map_err(|error| format!("Failed to download browser extension: {error}"))?;

    Ok(destination_path.to_string_lossy().into_owned())
}

#[tauri::command]
async fn check_backend_health_command(token: Option<String>) -> Result<HealthCheckResult, String> {
    check_backend_health(token).await
}

#[tauri::command]
async fn check_database_health_command(token: Option<String>) -> Result<DatabaseHealthResult, String> {
    check_database_health(token).await
}

#[cfg(not(debug_assertions))]
fn start_backend_process(
    data_dir: &Path,
    log_dir: &Path,
    jwt_secret: &str,
    settings_secret: &str,
) -> Result<std::process::Child, String> {
    let server_path = get_resource_path().join("server.cjs");
    let cwd = get_resource_path();
    let resources_root = get_packaged_resources_root();
    let local_model_resource_root = resources_root.join("model-packs");
    let local_onnx_wasm_root = resources_root
        .join("model-runtime")
        .join("onnxruntime-web");

    if !server_path.exists() {
        return Err(format!("Backend server not found at {:?}", server_path));
    }

    let node_exe = find_node_executable();
    if !node_exe.exists() {
        return Err(format!("Bundled node runtime not found at {:?}", node_exe));
    }

    println!("Starting backend with node: {:?}", node_exe);
    println!("Server path: {:?}", server_path);
    println!("Working directory: {:?}", cwd);

    let mut command = Command::new(&node_exe);
    command
        .arg(&server_path)
        .current_dir(&cwd)
        .env("HOST", &get_runtime_config().backend_host)
        .env("PORT", get_runtime_config().backend_port.to_string())
        .env("NODE_ENV", "production")
        .env("JWT_SECRET", jwt_secret)
        .env("SETTINGS_SECRET", settings_secret)
        .env("UI_CHAT_ALLOW_DEFAULT_BOOTSTRAP", "1")
        .env("UI_CHAT_BACKEND_URL", get_backend_url())
        .env("UI_CHAT_DATABASE_DIR", data_dir)
        .env("UI_CHAT_LOG_DIR", log_dir)
        .env("LOCAL_MODEL_RESOURCE_ROOT", local_model_resource_root)
        .env("LOCAL_MODEL_USER_DATA_DIR", data_dir.parent().unwrap_or(data_dir))
        .env("LOCAL_ONNX_WASM_ROOT", local_onnx_wasm_root);

    #[cfg(all(windows, not(debug_assertions)))]
    command.creation_flags(CREATE_NO_WINDOW);

    command
        .spawn()
        .map_err(|error| format!("Failed to spawn bundled backend: {}", error))
}

#[cfg(not(debug_assertions))]
fn find_node_executable() -> PathBuf {
    get_packaged_resources_root().join("node-runtime").join("node.exe")
}

fn get_native_host_source_path() -> PathBuf {
    #[cfg(debug_assertions)]
    {
        return PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("mira-clipper-ext")
            .join("dist")
            .join("native")
            .join("MiraWebBridgeHost.exe");
    }

    #[cfg(not(debug_assertions))]
    {
        get_packaged_resources_root()
            .join("browser-extension")
            .join("native")
            .join("MiraWebBridgeHost.exe")
    }
}

const NATIVE_MESSAGING_HOST_NAME: &str = "com.tomz.uichat.webbridge";
const NATIVE_MESSAGING_REGISTRY_KEY: &str = "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.tomz.uichat.webbridge";
const NATIVE_MESSAGING_ALLOWED_ORIGINS: &[&str] = &[
    // Development unpacked extension signed by mira-clipper-dev.pem.
    "chrome-extension://omdcdmcedejkenmjmkepgpinnehhmfkj/",
    // Production CRX signed by mira-clipper-prod.pem.
    "chrome-extension://nmoaglalgogogfaednbhpfadmdlpelag/",
];

fn native_paths_equal(left: &Path, right: &Path) -> bool {
    left.to_string_lossy().eq_ignore_ascii_case(&right.to_string_lossy())
}

#[cfg(windows)]
fn get_registered_native_host_manifest_path() -> Option<PathBuf> {
    let output = std::process::Command::new("reg.exe")
        .args(["QUERY", NATIVE_MESSAGING_REGISTRY_KEY, "/ve"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }

    String::from_utf8_lossy(&output.stdout)
        .lines()
        .find_map(|line| line.find("REG_SZ").map(|index| line[index + "REG_SZ".len()..].trim().to_string()))
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
}

#[tauri::command]
fn get_native_messaging_host_status_command<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> Result<serde_json::Value, String> {
    #[cfg(not(windows))]
    {
        let _ = app;
        return Ok(serde_json::json!({
            "status": "unsupported",
            "installed": false,
            "reason": "Native Messaging 当前仅支持 Windows"
        }));
    }

    #[cfg(windows)]
    {
        let manifest_path = app
            .path()
            .app_local_data_dir()
            .map_err(|error| format!("Failed to resolve app data directory: {error}"))?
            .join("native-host")
            .join(format!("{NATIVE_MESSAGING_HOST_NAME}.json"));
        let registered_manifest_path = get_registered_native_host_manifest_path();
        let manifest_exists = manifest_path.exists();

        if registered_manifest_path.is_none() && !manifest_exists {
            return Ok(serde_json::json!({ "status": "not_installed", "installed": false }));
        }
        let Some(registered_manifest_path) = registered_manifest_path else {
            return Ok(serde_json::json!({ "status": "repair_needed", "installed": false, "reason": "Chrome Native 注册项缺失" }));
        };
        if !native_paths_equal(&registered_manifest_path, &manifest_path) {
            return Ok(serde_json::json!({ "status": "repair_needed", "installed": false, "reason": "Chrome 注册项未指向当前 Mira" }));
        }
        if !manifest_exists {
            return Ok(serde_json::json!({ "status": "repair_needed", "installed": false, "reason": "Native manifest 文件缺失" }));
        }

        let manifest: serde_json::Value = match std::fs::read_to_string(&manifest_path)
            .ok()
            .and_then(|content| serde_json::from_str(&content).ok()) {
            Some(manifest) => manifest,
            None => return Ok(serde_json::json!({ "status": "repair_needed", "installed": false, "reason": "Native manifest 无法读取" })),
        };
        let host_path = manifest.get("path").and_then(|value| value.as_str()).map(PathBuf::from);
        let allowed_origins_match = manifest
            .get("allowed_origins")
            .and_then(|value| value.as_array())
            .map(|origins| NATIVE_MESSAGING_ALLOWED_ORIGINS.iter().all(|allowed_origin| {
                origins.iter().any(|origin| origin.as_str() == Some(*allowed_origin))
            }))
            .unwrap_or(false);
        if manifest.get("name").and_then(|value| value.as_str()) != Some(NATIVE_MESSAGING_HOST_NAME)
            || manifest.get("type").and_then(|value| value.as_str()) != Some("stdio")
            || !allowed_origins_match {
            return Ok(serde_json::json!({ "status": "repair_needed", "installed": false, "reason": "Native manifest 配置不匹配" }));
        }
        let Some(host_path) = host_path else {
            return Ok(serde_json::json!({ "status": "repair_needed", "installed": false, "reason": "Native Host 文件缺失" }));
        };
        let host_script_path = host_path.parent().map(|path| path.join("host.mjs"));
        let host_script_exists = host_script_path.as_ref().map(|path| path.exists()).unwrap_or(false);
        if !host_path.exists() || !host_script_exists {
            return Ok(serde_json::json!({ "status": "repair_needed", "installed": false, "reason": "Native Host 文件缺失" }));
        }
        if !native_paths_equal(&host_path, &get_native_host_source_path()) {
            return Ok(serde_json::json!({ "status": "repair_needed", "installed": false, "reason": "Native Host 需要更新" }));
        }

        return Ok(serde_json::json!({ "status": "installed", "installed": true }));
    }
}

#[tauri::command]
fn install_native_messaging_host_command<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> Result<serde_json::Value, String> {
    #[cfg(not(windows))]
    {
        let _ = app;
        return Err("Native Messaging 当前仅支持 Windows".to_string());
    }

    #[cfg(windows)]
    {
        let source_path = get_native_host_source_path();
        if !source_path.exists() {
            return Err(format!("Native Messaging Host 未打包: {:?}", source_path));
        }

        let host_dir = app
            .path()
            .app_local_data_dir()
            .map_err(|error| format!("Failed to resolve app data directory: {error}"))?
            .join("native-host");
        std::fs::create_dir_all(&host_dir)
            .map_err(|error| format!("Failed to create Native Host directory: {error}"))?;
        let manifest_path = host_dir.join(format!("{NATIVE_MESSAGING_HOST_NAME}.json"));
        let host_path = source_path;

        let manifest = serde_json::json!({
            "name": NATIVE_MESSAGING_HOST_NAME,
            "description": "触界 Native Messaging Host",
            "path": host_path,
            "type": "stdio",
            "allowed_origins": NATIVE_MESSAGING_ALLOWED_ORIGINS
        });
        std::fs::write(&manifest_path, serde_json::to_vec_pretty(&manifest).map_err(|error| error.to_string())?)
            .map_err(|error| format!("Failed to write Native Messaging manifest: {error}"))?;

        let status = std::process::Command::new("reg.exe")
            .args(["ADD", NATIVE_MESSAGING_REGISTRY_KEY, "/ve", "/t", "REG_SZ", "/d"])
            .arg(&manifest_path)
            .arg("/f")
            .status()
            .map_err(|error| format!("Failed to register Native Messaging Host: {error}"))?;
        if !status.success() {
            return Err(format!("reg.exe 注册 Native Messaging Host 失败: {status}"));
        }

        return Ok(serde_json::json!({
            "installed": true,
            "hostPath": host_path,
            "manifestPath": manifest_path,
            "version": "0.7.1"
        }));
    }
}

#[tauri::command]
fn uninstall_native_messaging_host_command<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> Result<serde_json::Value, String> {
    #[cfg(not(windows))]
    {
        let _ = app;
        return Err("Native Messaging 当前仅支持 Windows".to_string());
    }

    #[cfg(windows)]
    {
        let manifest_path = app
            .path()
            .app_local_data_dir()
            .map_err(|error| format!("Failed to resolve app data directory: {error}"))?
            .join("native-host")
            .join(format!("{NATIVE_MESSAGING_HOST_NAME}.json"));
        let status = std::process::Command::new("reg.exe")
            .args(["DELETE", NATIVE_MESSAGING_REGISTRY_KEY, "/f"])
            .status()
            .map_err(|error| format!("Failed to unregister Native Messaging Host: {error}"))?;
        if !status.success() && manifest_path.exists() {
            return Err(format!("reg.exe 注销 Native Messaging Host 失败: {status}"));
        }
        if manifest_path.exists() {
            std::fs::remove_file(&manifest_path)
                .map_err(|error| format!("Failed to remove Native Messaging manifest: {error}"))?;
        }
        return Ok(serde_json::json!({ "uninstalled": true, "manifestPath": manifest_path }));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .append_invoke_initialization_script(desktop_runtime_initialization_script())
        .on_window_event(|window, event| {
            #[cfg(not(debug_assertions))]
            if matches!(event, WindowEvent::CloseRequested { .. } | WindowEvent::Destroyed) {
                stop_backend_process(&window.app_handle());
            }
        })
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_backend_url_command,
            download_browser_extension_command,
            get_native_messaging_host_status_command,
            install_native_messaging_host_command,
            uninstall_native_messaging_host_command,
            check_backend_health_command,
            check_database_health_command
        ]);

    #[cfg(not(debug_assertions))]
    let builder = builder
        .manage(BackendProcess(Mutex::new(None)))
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_local_data_dir()
                .map_err(|error| format!("Failed to resolve app data directory: {}", error))?;
            let data_dir = app_data_dir.join("data");
            let log_dir = app_data_dir.join("logs");
            let secrets_dir = app_data_dir.join("secrets");
            let jwt_secret = ensure_secret_file(&secrets_dir.join("jwt-secret.txt"), "JWT secret")?;
            let settings_secret = ensure_secret_file(&secrets_dir.join("settings-secret.txt"), "settings secret")?;

            std::fs::create_dir_all(&data_dir)
                .map_err(|error| format!("Failed to create data directory {:?}: {}", data_dir, error))?;
            std::fs::create_dir_all(&log_dir)
                .map_err(|error| format!("Failed to create log directory {:?}: {}", log_dir, error))?;

            let process = start_backend_process(&data_dir, &log_dir, &jwt_secret, &settings_secret)?;
            *app.state::<BackendProcess>().0.lock().unwrap() = Some(process);
            Ok(())
        });

    let app = builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app
        .run(|_app_handle, _event| {
            #[cfg(not(debug_assertions))]
            if matches!(_event, RunEvent::ExitRequested { .. } | RunEvent::Exit) {
                stop_backend_process(_app_handle);
            }
        });
}

fn main() {
    run()
}

#[cfg(test)]
mod tests {
    use super::parse_runtime_config;

    #[test]
    fn parses_environment_backed_backend_port() {
        let config = parse_runtime_config(
            r#"
              module.exports = {
                backend: {
                  host: "127.0.0.1",
                  port: readPort("UI_CHAT_BACKEND_PORT", 8787),
                },
              };
            "#,
        )
        .expect("runtime config should parse");

        assert_eq!(config.backend_host, "127.0.0.1");
        assert_eq!(config.backend_port, 8787);
    }
}
