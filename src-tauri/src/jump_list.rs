#[cfg(target_os = "windows")]
mod windows_jump_list {
    use std::path::Path;

    use windows::{
        core::{Interface, HSTRING},
        Win32::{
            Foundation::PROPERTYKEY,
            System::Com::{
                CoCreateInstance, CoInitializeEx, CoUninitialize, StructuredStorage::PROPVARIANT,
                CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED,
            },
            UI::Shell::{
                Common::{IObjectArray, IObjectCollection},
                DestinationList, EnumerableObjectCollection, ICustomDestinationList, IShellLinkW,
                PropertiesSystem::IPropertyStore,
                SetCurrentProcessExplicitAppUserModelID, ShellLink,
            },
        },
    };

    const APP_USER_MODEL_ID: &str = "com.rafael.praxis";
    const PKEY_TITLE: PROPERTYKEY = PROPERTYKEY {
        fmtid: windows::core::GUID::from_u128(0xf29f85e0_4ff9_1068_ab91_08002b27b3d9),
        pid: 2,
    };
    const ITEMS: [(&str, &str, &str); 2] = [
        ("Meu Dia", "today", "today.ico"),
        ("Minha Semana", "my-week", "my-week.ico"),
    ];

    pub fn prepare_process_identity() -> Result<(), String> {
        unsafe {
            SetCurrentProcessExplicitAppUserModelID(&HSTRING::from(APP_USER_MODEL_ID))
                .map_err(|error| error.to_string())
        }
    }

    pub fn install(executable: &Path, resource_dir: &Path) -> Result<(), String> {
        let executable = executable.to_path_buf();
        let icon_dir = resource_dir.join("resources").join("jump-list");
        std::thread::spawn(move || configure(&executable, &icon_dir))
            .join()
            .map_err(|_| "A configuracao da Jump List falhou.".to_string())?
            .map_err(|error| error.to_string())
    }

    fn configure(executable: &Path, icon_dir: &Path) -> windows::core::Result<()> {
        unsafe {
            CoInitializeEx(None, COINIT_APARTMENTTHREADED).ok()?;

            let result = configure_initialized(executable, icon_dir);
            CoUninitialize();
            result
        }
    }

    unsafe fn configure_initialized(
        executable: &Path,
        icon_dir: &Path,
    ) -> windows::core::Result<()> {
        let app_id = HSTRING::from(APP_USER_MODEL_ID);

        let destination_list: ICustomDestinationList =
            CoCreateInstance(&DestinationList, None, CLSCTX_INPROC_SERVER)?;
        destination_list.SetAppID(&app_id)?;

        let mut minimum_slots = 0;
        let _removed: IObjectArray = destination_list.BeginList(&mut minimum_slots)?;
        let collection: IObjectCollection =
            CoCreateInstance(&EnumerableObjectCollection, None, CLSCTX_INPROC_SERVER)?;

        for (title, view, icon) in ITEMS {
            let link = create_link(executable, icon_dir, title, view, icon)?;
            collection.AddObject(&link)?;
        }

        let tasks: IObjectArray = collection.cast()?;
        destination_list.AddUserTasks(&tasks)?;
        destination_list.CommitList()
    }

    unsafe fn create_link(
        executable: &Path,
        icon_dir: &Path,
        title: &str,
        view: &str,
        icon: &str,
    ) -> windows::core::Result<IShellLinkW> {
        let link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER)?;
        let executable = HSTRING::from(executable.to_string_lossy().as_ref());
        let arguments = HSTRING::from(format!("--open-view={view}"));

        link.SetPath(&executable)?;
        link.SetArguments(&arguments)?;
        let icon_path = icon_dir.join(icon);
        if icon_path.exists() {
            link.SetIconLocation(&HSTRING::from(icon_path.to_string_lossy().as_ref()), 0)?;
        } else {
            link.SetIconLocation(&executable, 0)?;
        }
        link.SetDescription(&HSTRING::from(format!("Abrir {title} no Praxis")))?;

        let property_store: IPropertyStore = link.cast()?;
        let title_value = PROPVARIANT::from(title);
        property_store.SetValue(&PKEY_TITLE, &title_value)?;
        property_store.Commit()?;

        Ok(link)
    }
}

#[cfg(target_os = "windows")]
pub fn prepare_process_identity() -> Result<(), String> {
    windows_jump_list::prepare_process_identity()
}

#[cfg(not(target_os = "windows"))]
pub fn prepare_process_identity() -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "windows")]
pub fn install(executable: &std::path::Path, resource_dir: &std::path::Path) -> Result<(), String> {
    windows_jump_list::install(executable, resource_dir)
}

#[cfg(not(target_os = "windows"))]
pub fn install(
    _executable: &std::path::Path,
    _resource_dir: &std::path::Path,
) -> Result<(), String> {
    Ok(())
}
