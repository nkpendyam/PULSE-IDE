//! File watching for KYRO IDE

use tauri::WebviewWindow;

pub struct FileWatcher {
    _watcher: Option<notify::RecommendedWatcher>,
}

impl FileWatcher {
    pub fn new(_window: WebviewWindow) -> Self {
        Self { _watcher: None }
    }
}

impl Default for FileWatcher {
    fn default() -> Self { Self { _watcher: None } }
}
