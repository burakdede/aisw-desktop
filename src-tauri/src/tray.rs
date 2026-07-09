pub fn build_tray() -> tauri::tray::TrayIconBuilder<tauri::Wry> {
    tauri::tray::TrayIconBuilder::new().tooltip("AISW Desktop")
}
