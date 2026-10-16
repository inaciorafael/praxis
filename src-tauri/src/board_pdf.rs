use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use std::path::Path;

const MAX_BYTES: usize = 64 * 1024 * 1024;

fn decode_pdf_export(data: &str) -> Result<Vec<u8>, String> {
    let encoded = data
        .strip_prefix("data:application/pdf;base64,")
        .ok_or("Exportacao PDF invalida.")?;
    if encoded.len() > MAX_BYTES.div_ceil(3) * 4 {
        return Err("PDF excede 64 MiB.".into());
    }
    let bytes = BASE64
        .decode(encoded)
        .map_err(|_| "Exportacao base64 invalida.")?;
    if bytes.len() > MAX_BYTES || !bytes.starts_with(b"%PDF-1.") || !bytes.ends_with(b"%%EOF\n") {
        return Err("Documento PDF invalido ou excede 64 MiB.".into());
    }
    Ok(bytes)
}

fn validate_path(path: &Path) -> Result<(), String> {
    if !path.is_absolute()
        || !path
            .extension()
            .is_some_and(|extension| extension.to_string_lossy().eq_ignore_ascii_case("pdf"))
    {
        return Err("Selecione um caminho absoluto com extensao .pdf.".into());
    }
    Ok(())
}

/// Writes only the PDF destination selected explicitly in the native save dialog.
#[tauri::command]
pub fn export_board_pdf(path: String, data: String) -> Result<(), String> {
    let path = Path::new(&path);
    validate_path(path)?;
    let bytes = decode_pdf_export(&data)?;
    std::fs::write(path, bytes).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_pdf_data_and_rejects_wrong_payloads() {
        let pdf = b"%PDF-1.4\nfixture\n%%EOF\n";
        assert_eq!(
            decode_pdf_export(&format!(
                "data:application/pdf;base64,{}",
                BASE64.encode(pdf)
            ))
            .unwrap(),
            pdf
        );
        assert!(decode_pdf_export("data:image/png;base64,aGVsbG8=").is_err());
        assert!(decode_pdf_export("data:application/pdf;base64,aGVsbG8=").is_err());
        assert!(decode_pdf_export("data:application/pdf;base64,???").is_err());
        assert!(decode_pdf_export(&format!(
            "data:application/pdf;base64,{}",
            "A".repeat(MAX_BYTES.div_ceil(3) * 4 + 4)
        ))
        .is_err());
    }

    #[test]
    fn rejects_relative_and_non_pdf_destinations() {
        assert!(validate_path(Path::new("slides.pdf")).is_err());
        assert!(validate_path(&std::env::temp_dir().join("vault.praxis")).is_err());
        assert!(validate_path(&std::env::temp_dir().join("slides.PDF")).is_ok());
    }
}
