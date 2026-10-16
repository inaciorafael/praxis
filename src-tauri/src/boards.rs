use std::collections::HashSet;

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use uuid::Uuid;

use crate::{
    checklist,
    tasks::{self, CreateTaskInput, TaskView},
    vault::{mutate_active_document, read_active_document, VaultStore},
};

const FORMAT_VERSION: u32 = 1;
const MAX_BOARD_BYTES: usize = 20 * 1024 * 1024;
const MAX_IMAGE_BYTES: usize = 5 * 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BoardPoint {
    pub x: f64,
    pub y: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pressure: Option<f64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BoardDrawBrush {
    Graphite,
    Fountain,
    Ink,
    Charcoal,
    Marker,
    Watercolor,
    Spray,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BoardStrokeStyle {
    Pencil,
    Pen,
    #[default]
    Clean,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BoardTextHighlight {
    #[default]
    None,
    Yellow,
    Green,
    Pink,
    Blue,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BoardTextFont {
    Handwritten,
    #[default]
    Sans,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BoardTextAlign {
    #[default]
    Left,
    Center,
    Right,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BoardTextBackground {
    #[default]
    None,
    Rectangle,
    Ellipse,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BoardTextVerticalAlign {
    #[default]
    Top,
    Middle,
    Bottom,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BoardTextList {
    None,
    Bullet,
    Ordered,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BoardTextRun {
    pub text: String,
    pub bold: bool,
    pub italic: bool,
    pub underline: bool,
    pub font: BoardTextFont,
    pub font_size: f64,
    pub color: String,
    pub highlight: BoardTextHighlight,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub annotation: Option<BoardTextAnnotation>,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum BoardAnnotationType {
    Underline,
    Box,
    Circle,
    Highlight,
    StrikeThrough,
    CrossedOff,
    Bracket,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BoardAnnotationBracket {
    Top,
    Right,
    Bottom,
    Left,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum BoardAnnotationPadding {
    Uniform(f64),
    Sides(Vec<f64>),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BoardTextAnnotation {
    #[serde(rename = "type")]
    pub annotation_type: BoardAnnotationType,
    pub color: String,
    pub stroke_width: f64,
    pub padding: BoardAnnotationPadding,
    pub iterations: u8,
    pub brackets: Vec<BoardAnnotationBracket>,
    pub animate: bool,
    pub animation_duration: u32,
    pub animation_delay: u32,
    pub multiline: bool,
    #[serde(default)]
    pub rtl: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BoardTextParagraph {
    pub align: BoardTextAlign,
    pub list: BoardTextList,
    pub runs: Vec<BoardTextRun>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BoardRichText {
    pub paragraphs: Vec<BoardTextParagraph>,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum BoardFillStyle {
    Solid,
    Hachure,
    CrossHatch,
    Dots,
    Zigzag,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BoardStrokePattern {
    Solid,
    Dashed,
    Dotted,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BoardSketchOptions {
    pub stroke_pattern: BoardStrokePattern,
    pub roughness: f64,
    pub bowing: f64,
    pub hachure_angle: f64,
    pub hachure_gap: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardElement {
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub group_id: Option<String>,
    pub kind: String,
    pub x: f64,
    pub y: f64,
    #[serde(default)]
    pub angle: f64,
    pub width: f64,
    pub height: f64,
    pub text: String,
    pub color: String,
    #[serde(default)]
    pub stroke_style: BoardStrokeStyle,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub draw_brush: Option<BoardDrawBrush>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stroke_width: Option<f64>,
    #[serde(default = "default_opacity")]
    pub opacity: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stroke_color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fill_color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fill_style: Option<BoardFillStyle>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sketch: Option<BoardSketchOptions>,
    #[serde(default)]
    pub text_highlight: BoardTextHighlight,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text_annotation: Option<BoardTextAnnotation>,
    #[serde(default)]
    pub text_font: BoardTextFont,
    #[serde(default)]
    pub text_background: BoardTextBackground,
    #[serde(default)]
    pub text_align: BoardTextAlign,
    #[serde(default)]
    pub text_vertical_align: BoardTextVerticalAlign,
    #[serde(default)]
    pub text_auto_width: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rich_text: Option<BoardRichText>,
    pub resolved: bool,
    pub points: Vec<BoardPoint>,
    pub start_id: Option<String>,
    pub end_id: Option<String>,
    pub task_id: Option<String>,
    pub image_data: Option<String>,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BoardKind {
    #[default]
    Board,
    Paper,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BoardBackground {
    #[default]
    Plain,
    Grid,
    Ruled,
    Dots,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BoardColorScheme {
    #[default]
    Light,
    Dark,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum BoardSceneAspectRatio {
    #[serde(rename = "16:9")]
    Wide,
    #[serde(rename = "4:3")]
    Standard,
    #[serde(rename = "free")]
    Free,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BoardScene {
    pub id: String,
    pub title: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub aspect_ratio: BoardSceneAspectRatio,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Board {
    pub id: String,
    #[serde(default)]
    pub locked: bool,
    #[serde(default)]
    pub kind: BoardKind,
    #[serde(default)]
    pub background: BoardBackground,
    #[serde(default)]
    pub color_scheme: BoardColorScheme,
    pub title: String,
    pub format_version: u32,
    pub revision: u64,
    pub elements: Vec<BoardElement>,
    #[serde(default)]
    pub scenes: Vec<BoardScene>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardSummary {
    id: String,
    locked: bool,
    kind: BoardKind,
    background: BoardBackground,
    color_scheme: BoardColorScheme,
    title: String,
    format_version: u32,
    revision: u64,
    created_at: String,
    updated_at: String,
    element_count: usize,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBoardInput {
    #[serde(default)]
    scenes: Vec<BoardScene>,
    #[serde(default)]
    kind: BoardKind,
    #[serde(default)]
    background: BoardBackground,
    #[serde(default)]
    color_scheme: BoardColorScheme,
    title: String,
    elements: Vec<BoardElement>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveBoardInput {
    #[serde(default)]
    scenes: Option<Vec<BoardScene>>,
    id: String,
    #[serde(default)]
    locked: Option<bool>,
    title: String,
    elements: Vec<BoardElement>,
    expected_revision: u64,
    #[serde(default)]
    background: Option<BoardBackground>,
    #[serde(default)]
    color_scheme: Option<BoardColorScheme>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardTaskResult {
    board: Board,
    task_id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardTaskReference {
    board_id: String,
    board_title: String,
    element_id: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BoardTaskOperation {
    operation_id: String,
    board_id: String,
    element_id: String,
    task_id: String,
}

fn now_iso() -> Result<String, String> {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .map_err(|error| error.to_string())
}

fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 128
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | ':'))
}

fn default_opacity() -> f64 {
    1.0
}

fn valid_hex_color(color: &str) -> bool {
    let bytes = color.as_bytes();
    bytes.len() == 7 && bytes[0] == b'#' && bytes[1..].iter().all(u8::is_ascii_hexdigit)
}

fn validate_image(data: &str) -> Result<(), String> {
    if data.len() > MAX_IMAGE_BYTES * 4 / 3 + 64 {
        return Err("Imagem excede 5 MiB.".into());
    }
    let (format, encoded) = data.split_once(",").ok_or("Imagem invalida.")?;
    let bytes = BASE64
        .decode(encoded)
        .map_err(|_| "Imagem base64 invalida.")?;
    if bytes.len() > MAX_IMAGE_BYTES {
        return Err("Imagem excede 5 MiB.".into());
    }
    let valid = match format {
        "data:image/png;base64" => bytes.starts_with(b"\x89PNG\r\n\x1a\n"),
        "data:image/jpeg;base64" => bytes.starts_with(b"\xff\xd8\xff"),
        "data:image/webp;base64" => {
            bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP".as_slice())
        }
        _ => false,
    };
    if !valid {
        return Err("Use imagens PNG, JPEG ou WebP validas.".into());
    }
    Ok(())
}

fn validate_board(board: &Board) -> Result<(), String> {
    if board.format_version != FORMAT_VERSION {
        return Err("Versao do quadro nao suportada.".into());
    }
    if !valid_id(&board.id) || board.revision == 0 {
        return Err("Identificacao do quadro invalida.".into());
    }
    if board.title.trim().is_empty() || board.title.len() > 512 {
        return Err("Informe um titulo de ate 512 bytes.".into());
    }
    if board.elements.len() > 2000 {
        return Err("Quadro excede 2000 elementos.".into());
    }
    if board.scenes.len() > 100 {
        return Err("Paper excede 100 cenas.".into());
    }
    let mut scene_ids = HashSet::new();
    for scene in &board.scenes {
        if !valid_id(&scene.id) || !scene_ids.insert(&scene.id) {
            return Err("Identificacao de cena invalida ou duplicada.".into());
        }
        if scene.title.trim().is_empty() || scene.title.chars().count() > 200 {
            return Err("Informe um titulo de cena de ate 200 caracteres.".into());
        }
        if [scene.x, scene.y, scene.width, scene.height]
            .iter()
            .any(|v| !v.is_finite() || v.abs() > 1_000_000.0)
            || scene.width <= 0.0
            || scene.height <= 0.0
        {
            return Err("Enquadramento de cena invalido.".into());
        }
    }
    let mut ids = HashSet::new();
    for element in &board.elements {
        if element
            .group_id
            .as_ref()
            .is_some_and(|id| id.trim().is_empty() || id.len() > 100)
        {
            return Err("Identificador de grupo invalido.".into());
        }
        if let Some(sketch) = &element.sketch {
            if element.kind == "draw"
                || element.kind == "image"
                || (element.kind == "text" && element.text_background == BoardTextBackground::None)
                || !sketch.roughness.is_finite()
                || !(0.0..=2.0).contains(&sketch.roughness)
                || !sketch.bowing.is_finite()
                || !(0.0..=2.0).contains(&sketch.bowing)
                || !sketch.hachure_angle.is_finite()
                || !(-90.0..=90.0).contains(&sketch.hachure_angle)
                || !sketch.hachure_gap.is_finite()
                || !(5.0..=24.0).contains(&sketch.hachure_gap)
            {
                return Err("Acabamento de forma invalido.".into());
            }
        }
        if element.draw_brush.is_some() && element.kind != "draw" {
            return Err("Pincel artistico permitido apenas em desenho livre.".into());
        }
        if element
            .stroke_width
            .is_some_and(|width| !width.is_finite() || !(0.5..=32.0).contains(&width))
        {
            return Err("Espessura de traco deve estar entre 0.5 e 32.".into());
        }
        if !element.opacity.is_finite() || !(0.05..=1.0).contains(&element.opacity) {
            return Err("Opacidade deve estar entre 0.05 e 1.".into());
        }
        if element
            .stroke_color
            .as_ref()
            .is_some_and(|color| !valid_hex_color(color))
        {
            return Err("Cor de traco deve usar #RRGGBB.".into());
        }
        if !element.angle.is_finite() || element.angle.abs() > std::f64::consts::TAU {
            return Err("Angulo de elemento deve estar entre -2pi e 2pi radianos.".into());
        }
        if element.fill_color.is_some() || element.fill_style.is_some() {
            let supports_fill = [
                "rectangle",
                "ellipse",
                "triangle",
                "hexagon",
                "frame",
                "note",
                "question",
                "decision",
                "task",
            ]
            .contains(&element.kind.as_str())
                || (element.kind == "text" && element.text_background != BoardTextBackground::None);
            if !supports_fill
                || element
                    .fill_color
                    .as_ref()
                    .is_some_and(|color| color != "transparent" && !valid_hex_color(color))
            {
                return Err("Preenchimento requer uma forma e cor #RRGGBB ou transparent.".into());
            }
        }
        if let Some(rich_text) = &element.rich_text {
            validate_rich_text(element, rich_text)?;
        }
        if let Some(annotation) = &element.text_annotation {
            validate_text_annotation(annotation)?;
        }
        if !valid_id(&element.id) || !ids.insert(element.id.as_str()) {
            return Err("Elementos possuem IDs invalidos ou duplicados.".into());
        }
        if ![
            "text",
            "note",
            "rectangle",
            "ellipse",
            "triangle",
            "hexagon",
            "frame",
            "arrow",
            "line",
            "draw",
            "question",
            "decision",
            "task",
            "image",
        ]
        .contains(&element.kind.as_str())
        {
            return Err("Tipo de elemento invalido.".into());
        }
        if !["neutral", "amber", "sage", "blue", "rose", "purple"].contains(&element.color.as_str())
        {
            return Err("Cor de elemento invalida.".into());
        }
        if [element.x, element.y, element.width, element.height]
            .iter()
            .any(|v| !v.is_finite() || v.abs() > 1_000_000.0)
            || (!["arrow", "line"].contains(&element.kind.as_str())
                && (element.width <= 0.0 || element.height <= 0.0))
        {
            return Err("Dimensoes de elemento invalidas.".into());
        }
        if element.kind == "line" && (element.start_id.is_some() || element.end_id.is_some()) {
            return Err("Linha reta nao pode possuir conexoes ancoradas.".into());
        }
        if element.text.len() > 100_000
            || element.points.len() > 20_000
            || element.points.iter().any(|p| {
                !p.x.is_finite()
                    || !p.y.is_finite()
                    || p.x.abs() > 1_000_000.0
                    || p.y.abs() > 1_000_000.0
                    || p.pressure.is_some_and(|pressure| {
                        !pressure.is_finite() || !(0.0..=1.0).contains(&pressure)
                    })
            })
        {
            return Err("Conteudo do elemento excede os limites.".into());
        }
        for id in [&element.start_id, &element.end_id, &element.task_id]
            .into_iter()
            .flatten()
        {
            if !valid_id(id) {
                return Err("Referencia de elemento invalida.".into());
            }
        }
        match (&element.image_data, element.kind.as_str()) {
            (Some(data), "image") => validate_image(data)?,
            (None, "image") => return Err("Imagem ausente.".into()),
            (Some(_), _) => return Err("Imagem permitida apenas em elemento de imagem.".into()),
            _ => (),
        }
    }
    for element in &board.elements {
        for endpoint in [&element.start_id, &element.end_id].into_iter().flatten() {
            if !ids.contains(endpoint.as_str()) || endpoint == &element.id {
                return Err("Conexao aponta para elemento inexistente.".into());
            }
        }
    }
    if serde_json::to_vec(board)
        .map_err(|error| error.to_string())?
        .len()
        > MAX_BOARD_BYTES
    {
        return Err("Quadro excede 20 MiB.".into());
    }
    Ok(())
}

fn validate_text_annotation(annotation: &BoardTextAnnotation) -> Result<(), String> {
    if !valid_hex_color(&annotation.color) {
        return Err("Cor de anotacao deve usar #RRGGBB.".into());
    }
    let valid_padding = match &annotation.padding {
        BoardAnnotationPadding::Uniform(value) => value.is_finite() && (0.0..=24.0).contains(value),
        BoardAnnotationPadding::Sides(values) => {
            [2, 4].contains(&values.len())
                && values
                    .iter()
                    .all(|value| value.is_finite() && (0.0..=24.0).contains(value))
        }
    };
    if !annotation.stroke_width.is_finite()
        || !(0.5..=8.0).contains(&annotation.stroke_width)
        || !valid_padding
        || !(1..=4).contains(&annotation.iterations)
        || !(100..=5000).contains(&annotation.animation_duration)
        || annotation.animation_delay > 5000
    {
        return Err("Configuracao de anotacao fora dos limites.".into());
    }
    let sides: HashSet<_> = annotation.brackets.iter().collect();
    if annotation.brackets.is_empty()
        || annotation.brackets.len() > 4
        || sides.len() != annotation.brackets.len()
    {
        return Err("Lados de anotacao devem ser unicos, entre um e quatro.".into());
    }
    Ok(())
}

fn validate_rich_text(element: &BoardElement, rich_text: &BoardRichText) -> Result<(), String> {
    if ![
        "text",
        "note",
        "rectangle",
        "ellipse",
        "triangle",
        "hexagon",
        "frame",
        "question",
        "decision",
        "task",
    ]
    .contains(&element.kind.as_str())
    {
        return Err("Texto formatado requer um elemento com texto editavel.".into());
    }
    if rich_text.paragraphs.len() > 1000 {
        return Err("Texto formatado excede 1000 paragrafos.".into());
    }
    let mut run_count = 0;
    let mut plain_text = String::new();
    for (index, paragraph) in rich_text.paragraphs.iter().enumerate() {
        if index > 0 {
            plain_text.push('\n');
        }
        run_count += paragraph.runs.len();
        if run_count > 10_000 {
            return Err("Texto formatado excede 10000 trechos.".into());
        }
        for run in &paragraph.runs {
            if let Some(annotation) = &run.annotation {
                validate_text_annotation(annotation)?;
            }
            if !run.font_size.is_finite() || !(8.0..=72.0).contains(&run.font_size) {
                return Err("Tamanho de fonte deve estar entre 8 e 72.".into());
            }
            let color = run.color.as_bytes();
            if color.len() != 7 || color[0] != b'#' || !color[1..].iter().all(u8::is_ascii_hexdigit)
            {
                return Err("Cor de texto deve usar #RRGGBB.".into());
            }
            if plain_text.len() + run.text.len() > 100_000 {
                return Err("Texto formatado excede 100000 bytes.".into());
            }
            plain_text.push_str(&run.text);
        }
    }
    if plain_text.len() > 100_000 || plain_text != element.text {
        return Err("Texto simples diverge do texto formatado.".into());
    }
    Ok(())
}

fn read_boards(document: &Value) -> Result<Vec<Board>, String> {
    let boards: Vec<Board> = match document.get("boards") {
        None => vec![],
        Some(value) => serde_json::from_value(value.clone())
            .map_err(|error| format!("Quadros invalidos: {error}"))?,
    };
    let mut ids = HashSet::new();
    for board in &boards {
        validate_board(board)?;
        if !ids.insert(&board.id) {
            return Err("IDs de quadros duplicados.".into());
        }
    }
    Ok(boards)
}

fn write_boards(document: &mut Value, boards: &[Board]) -> Result<(), String> {
    document
        .as_object_mut()
        .ok_or("Documento invalido.")?
        .insert(
            "boards".into(),
            serde_json::to_value(boards).map_err(|error| error.to_string())?,
        );
    Ok(())
}

fn find_board(boards: &[Board], id: &str) -> Result<usize, String> {
    boards
        .iter()
        .position(|board| board.id == id)
        .ok_or_else(|| "Quadro nao encontrado.".into())
}

fn check_revision(board: &Board, expected: u64) -> Result<(), String> {
    if board.revision != expected {
        return Err(
            "O quadro foi alterado. Recarregue ou preserve seu rascunho antes de continuar.".into(),
        );
    }
    Ok(())
}

fn create_in_document(document: &mut Value, input: CreateBoardInput) -> Result<Board, String> {
    let mut boards = read_boards(document)?;
    let now = now_iso()?;
    let board = Board {
        id: Uuid::new_v4().to_string(),
        locked: false,
        kind: input.kind,
        background: input.background,
        color_scheme: input.color_scheme,
        title: input.title.trim().into(),
        format_version: FORMAT_VERSION,
        revision: 1,
        elements: input.elements,
        scenes: input.scenes,
        created_at: now.clone(),
        updated_at: now,
    };
    validate_board(&board)?;
    boards.push(board.clone());
    write_boards(document, &boards)?;
    Ok(board)
}

fn save_in_document(document: &mut Value, input: SaveBoardInput) -> Result<Board, String> {
    let mut boards = read_boards(document)?;
    let index = find_board(&boards, &input.id)?;
    let board = &mut boards[index];
    check_revision(board, input.expected_revision)?;
    let background = input.background.unwrap_or(board.background);
    let color_scheme = input.color_scheme.unwrap_or(board.color_scheme);
    let locked = input.locked.unwrap_or(board.locked);
    let scenes = input.scenes.unwrap_or_else(|| board.scenes.clone());
    let content_changed = board.title != input.title.trim()
        || board.elements != input.elements
        || board.scenes != scenes
        || board.background != background
        || board.color_scheme != color_scheme;
    if board.locked && content_changed {
        return Err("Desbloqueie o Paper antes de editar.".into());
    }
    if board.title == input.title.trim()
        && board.elements == input.elements
        && board.scenes == scenes
        && board.background == background
        && board.color_scheme == color_scheme
        && board.locked == locked
    {
        return Ok(board.clone());
    }
    board.title = input.title.trim().into();
    board.elements = input.elements;
    board.scenes = scenes;
    board.background = background;
    board.color_scheme = color_scheme;
    board.locked = locked;
    board.revision = board
        .revision
        .checked_add(1)
        .ok_or("Limite de revisoes atingido.")?;
    board.updated_at = now_iso()?;
    validate_board(board)?;
    let saved = board.clone();
    write_boards(document, &boards)?;
    Ok(saved)
}

#[tauri::command]
pub fn list_boards(vault: tauri::State<'_, VaultStore>) -> Result<Vec<BoardSummary>, String> {
    let boards = read_boards(&read_active_document(&vault)?)?;
    Ok(boards.into_iter().map(board_summary).collect())
}

fn board_summary(board: Board) -> BoardSummary {
    BoardSummary {
        id: board.id,
        locked: board.locked,
        kind: board.kind,
        background: board.background,
        color_scheme: board.color_scheme,
        title: board.title,
        format_version: board.format_version,
        revision: board.revision,
        created_at: board.created_at,
        updated_at: board.updated_at,
        element_count: board.elements.len(),
    }
}

#[tauri::command]
pub fn get_board(vault: tauri::State<'_, VaultStore>, id: String) -> Result<Board, String> {
    let boards = read_boards(&read_active_document(&vault)?)?;
    Ok(boards[find_board(&boards, &id)?].clone())
}

#[tauri::command]
pub fn create_board(
    vault: tauri::State<'_, VaultStore>,
    input: CreateBoardInput,
) -> Result<Board, String> {
    mutate_active_document(&vault, |document| create_in_document(document, input))
}

#[tauri::command]
pub fn save_board(
    vault: tauri::State<'_, VaultStore>,
    input: SaveBoardInput,
) -> Result<Board, String> {
    mutate_active_document(&vault, |document| save_in_document(document, input))
}

#[tauri::command]
pub fn delete_board(
    vault: tauri::State<'_, VaultStore>,
    id: String,
    expected_revision: u64,
) -> Result<(), String> {
    mutate_active_document(&vault, |document| {
        delete_in_document(document, &id, expected_revision)
    })
}

fn delete_in_document(
    document: &mut Value,
    id: &str,
    expected_revision: u64,
) -> Result<(), String> {
    let mut boards = read_boards(document)?;
    let index = find_board(&boards, id)?;
    check_revision(&boards[index], expected_revision)?;
    if boards[index].locked {
        return Err("Desbloqueie o Paper antes de excluir.".into());
    }
    let mut links = read_paper_links(document)?;
    links.retain(|link| link.paper_id != id);
    if document.get("paperLinks").is_some() {
        write_paper_links(document, &links)?;
    }
    boards.remove(index);
    write_boards(document, &boards)
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PaperLink {
    task_id: String,
    paper_id: String,
    created_at: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PaperCreateOperation {
    operation_id: String,
    task_id: String,
    paper_id: String,
}

fn read_paper_links(document: &Value) -> Result<Vec<PaperLink>, String> {
    match document.get("paperLinks") {
        None => Ok(vec![]),
        Some(value) => serde_json::from_value(value.clone())
            .map_err(|error| format!("Vinculos de Paper invalidos: {error}")),
    }
}

fn write_paper_links(document: &mut Value, links: &[PaperLink]) -> Result<(), String> {
    document
        .as_object_mut()
        .ok_or("Documento invalido.")?
        .insert(
            "paperLinks".into(),
            serde_json::to_value(links).map_err(|error| error.to_string())?,
        );
    Ok(())
}

/// Removes only attachment references when an official task is permanently deleted.
pub(crate) fn remove_task_paper_links(document: &mut Value, task_id: &str) -> Result<(), String> {
    let mut links = read_paper_links(document)?;
    let before = links.len();
    links.retain(|link| link.task_id != task_id);
    if before != links.len() {
        write_paper_links(document, &links)?;
    }
    Ok(())
}

fn ensure_task(document: &Value, task_id: &str) -> Result<(), String> {
    if !valid_id(task_id)
        || !tasks::read_tasks_from_document(document)?
            .iter()
            .any(|task| task.id == task_id)
    {
        return Err("Tarefa nao encontrada.".into());
    }
    Ok(())
}

fn ensure_paper(document: &Value, paper_id: &str) -> Result<Board, String> {
    let boards = read_boards(document)?;
    Ok(boards[find_board(&boards, paper_id)?].clone())
}

fn attach_paper_in_document(
    document: &mut Value,
    task_id: &str,
    paper_id: &str,
) -> Result<(), String> {
    ensure_task(document, task_id)?;
    ensure_paper(document, paper_id)?;
    let mut links = read_paper_links(document)?;
    if links
        .iter()
        .any(|link| link.task_id == task_id && link.paper_id == paper_id)
    {
        return Ok(());
    }
    links.push(PaperLink {
        task_id: task_id.into(),
        paper_id: paper_id.into(),
        created_at: now_iso()?,
    });
    write_paper_links(document, &links)
}

fn detach_paper_in_document(
    document: &mut Value,
    task_id: &str,
    paper_id: &str,
) -> Result<(), String> {
    if !valid_id(task_id) || !valid_id(paper_id) {
        return Err("Referencia de Paper invalida.".into());
    }
    let mut links = read_paper_links(document)?;
    let before = links.len();
    links.retain(|link| link.task_id != task_id || link.paper_id != paper_id);
    if before != links.len() {
        write_paper_links(document, &links)?;
    }
    Ok(())
}

fn create_paper_in_document(
    document: &mut Value,
    task_id: &str,
    title: String,
    operation_id: &str,
) -> Result<Board, String> {
    if !valid_id(operation_id) {
        return Err("Identificacao de operacao invalida.".into());
    }
    ensure_task(document, task_id)?;
    let mut operations: Vec<PaperCreateOperation> = match document.get("paperCreateOperations") {
        None => vec![],
        Some(value) => serde_json::from_value(value.clone()).map_err(|error| error.to_string())?,
    };
    if let Some(operation) = operations
        .iter()
        .find(|operation| operation.operation_id == operation_id)
    {
        if operation.task_id != task_id {
            return Err("Operacao ja utilizada para outra tarefa.".into());
        }
        return ensure_paper(document, &operation.paper_id);
    }
    // Stage all changes so failed validation cannot leave a partial Paper or attachment.
    let mut staged = document.clone();
    let paper = create_in_document(
        &mut staged,
        CreateBoardInput {
            scenes: vec![],
            background: BoardBackground::Plain,
            color_scheme: BoardColorScheme::Light,
            kind: BoardKind::Paper,
            title,
            elements: vec![],
        },
    )?;
    attach_paper_in_document(&mut staged, task_id, &paper.id)?;
    operations.push(PaperCreateOperation {
        operation_id: operation_id.into(),
        task_id: task_id.into(),
        paper_id: paper.id.clone(),
    });
    staged.as_object_mut().ok_or("Documento invalido.")?.insert(
        "paperCreateOperations".into(),
        serde_json::to_value(operations).map_err(|error| error.to_string())?,
    );
    *document = staged;
    Ok(paper)
}

fn task_papers_from_document(document: &Value, task_id: &str) -> Result<Vec<BoardSummary>, String> {
    if !tasks::read_tasks_from_document(document)?
        .iter()
        .any(|task| task.id == task_id)
    {
        return Ok(vec![]);
    }
    let links = read_paper_links(document)?;
    let ids: HashSet<&str> = links
        .iter()
        .filter(|link| link.task_id == task_id)
        .map(|link| link.paper_id.as_str())
        .collect();
    Ok(read_boards(document)?
        .into_iter()
        .filter(|board| ids.contains(board.id.as_str()))
        .map(board_summary)
        .collect())
}

fn paper_contexts_from_document(
    document: &Value,
    paper_id: &str,
    today: &str,
) -> Result<Vec<TaskView>, String> {
    ensure_paper(document, paper_id)?;
    let links = read_paper_links(document)?;
    let ids: HashSet<&str> = links
        .iter()
        .filter(|link| link.paper_id == paper_id)
        .map(|link| link.task_id.as_str())
        .collect();
    let checklist = checklist::read_checklist_items_from_document(document)?;
    Ok(tasks::read_tasks_from_document(document)?
        .iter()
        .filter(|task| ids.contains(task.id.as_str()))
        .map(|task| tasks::task_view(task, &checklist, today))
        .collect())
}

#[tauri::command]
pub fn list_task_papers(
    vault: tauri::State<'_, VaultStore>,
    task_id: String,
) -> Result<Vec<BoardSummary>, String> {
    task_papers_from_document(&read_active_document(&vault)?, &task_id)
}

#[tauri::command]
pub fn list_paper_task_contexts(
    vault: tauri::State<'_, VaultStore>,
    paper_id: String,
    today: String,
) -> Result<Vec<TaskView>, String> {
    paper_contexts_from_document(&read_active_document(&vault)?, &paper_id, &today)
}

#[tauri::command]
pub fn create_task_paper(
    vault: tauri::State<'_, VaultStore>,
    task_id: String,
    title: String,
    operation_id: String,
) -> Result<Board, String> {
    mutate_active_document(&vault, |document| {
        create_paper_in_document(document, &task_id, title, &operation_id)
    })
}

#[tauri::command]
pub fn attach_task_paper(
    vault: tauri::State<'_, VaultStore>,
    task_id: String,
    paper_id: String,
) -> Result<(), String> {
    mutate_active_document(&vault, |document| {
        attach_paper_in_document(document, &task_id, &paper_id)
    })
}

#[tauri::command]
pub fn detach_task_paper(
    vault: tauri::State<'_, VaultStore>,
    task_id: String,
    paper_id: String,
) -> Result<(), String> {
    mutate_active_document(&vault, |document| {
        detach_paper_in_document(document, &task_id, &paper_id)
    })
}

fn create_task_link(
    document: &mut Value,
    board_id: &str,
    element_id: &str,
    expected_revision: u64,
    operation_id: &str,
    title: String,
    notes: Option<String>,
) -> Result<BoardTaskResult, String> {
    if !valid_id(operation_id) {
        return Err("Identificacao de operacao invalida.".into());
    }
    if title.trim().is_empty()
        || title.len() > 100_000
        || notes.as_ref().is_some_and(|value| value.len() > 100_000)
    {
        return Err("Titulo ou notas da tarefa invalidos.".into());
    }
    let mut boards = read_boards(document)?;
    let index = find_board(&boards, board_id)?;
    let mut operations: Vec<BoardTaskOperation> = match document.get("boardTaskOperations") {
        Some(value) => serde_json::from_value(value.clone()).map_err(|error| error.to_string())?,
        None => vec![],
    };
    if let Some(operation) = operations
        .iter()
        .find(|operation| operation.operation_id == operation_id)
    {
        if operation.board_id != board_id || operation.element_id != element_id {
            return Err("Operacao ja utilizada para outro elemento.".into());
        }
        return Ok(BoardTaskResult {
            board: boards[index].clone(),
            task_id: operation.task_id.clone(),
        });
    }
    let board = &mut boards[index];
    check_revision(board, expected_revision)?;
    if board.locked {
        return Err("Desbloqueie o Paper antes de criar uma tarefa no elemento.".into());
    }
    let element = board
        .elements
        .iter_mut()
        .find(|element| element.id == element_id)
        .ok_or("Elemento nao encontrado.")?;
    if !["question", "decision", "note", "text", "task"].contains(&element.kind.as_str())
        || element.task_id.is_some()
    {
        return Err("Este elemento nao pode criar outra tarefa.".into());
    }
    let input: CreateTaskInput = serde_json::from_value(json!({ "title": title, "notes": notes, "plannedFor": null, "dueAt": null, "reminderAt": null })).map_err(|error| error.to_string())?;
    let task_id = tasks::create_task_in_document(document, input)?;
    element.task_id = Some(task_id.clone());
    board.revision = board
        .revision
        .checked_add(1)
        .ok_or("Limite de revisoes atingido.")?;
    board.updated_at = now_iso()?;
    validate_board(board)?;
    let result = BoardTaskResult {
        board: board.clone(),
        task_id: task_id.clone(),
    };
    operations.push(BoardTaskOperation {
        operation_id: operation_id.into(),
        board_id: board_id.into(),
        element_id: element_id.into(),
        task_id,
    });
    document
        .as_object_mut()
        .ok_or("Documento invalido.")?
        .insert(
            "boardTaskOperations".into(),
            serde_json::to_value(operations).map_err(|error| error.to_string())?,
        );
    write_boards(document, &boards)?;
    Ok(result)
}

#[tauri::command]
pub fn create_board_task(
    vault: tauri::State<'_, VaultStore>,
    board_id: String,
    element_id: String,
    expected_revision: u64,
    operation_id: String,
    title: String,
    notes: Option<String>,
) -> Result<BoardTaskResult, String> {
    mutate_active_document(&vault, |document| {
        create_task_link(
            document,
            &board_id,
            &element_id,
            expected_revision,
            &operation_id,
            title,
            notes,
        )
    })
}

#[tauri::command]
pub fn get_board_tasks(
    vault: tauri::State<'_, VaultStore>,
    board_id: String,
    today: String,
) -> Result<Vec<TaskView>, String> {
    let document = read_active_document(&vault)?;
    let boards = read_boards(&document)?;
    let board = &boards[find_board(&boards, &board_id)?];
    let ids: HashSet<&str> = board
        .elements
        .iter()
        .filter_map(|element| element.task_id.as_deref())
        .collect();
    let checklist = checklist::read_checklist_items_from_document(&document)?;
    Ok(tasks::read_tasks_from_document(&document)?
        .iter()
        .filter(|task| ids.contains(task.id.as_str()))
        .map(|task| tasks::task_view(task, &checklist, &today))
        .collect())
}

fn task_details_from_document(
    document: &Value,
    board_id: &str,
    task_id: &str,
    today: &str,
) -> Result<tasks::TaskSearchResult, String> {
    let boards = read_boards(document)?;
    let board = &boards[find_board(&boards, board_id)?];
    let element_linked = board
        .elements
        .iter()
        .any(|element| element.task_id.as_deref() == Some(task_id));
    let paper_linked = read_paper_links(document)?
        .iter()
        .any(|link| link.paper_id == board_id && link.task_id == task_id);
    if !element_linked && !paper_linked {
        return Err("A tarefa nao esta vinculada a este quadro.".into());
    }
    let records = tasks::read_tasks_from_document(document)?;
    let Some(task) = records.iter().find(|task| task.id == task_id) else {
        return Ok(tasks::TaskSearchResult {
            tasks: vec![],
            checklist_items: vec![],
            total: 0,
        });
    };
    let checklist_items: Vec<_> = checklist::read_checklist_items_from_document(document)?
        .into_iter()
        .filter(|item| item.task_id == task_id)
        .collect();
    Ok(tasks::TaskSearchResult {
        tasks: vec![tasks::task_view(task, &checklist_items, today)],
        checklist_items,
        total: 1,
    })
}

#[tauri::command]
pub fn get_board_task_details(
    vault: tauri::State<'_, VaultStore>,
    board_id: String,
    task_id: String,
    today: String,
) -> Result<tasks::TaskSearchResult, String> {
    task_details_from_document(&read_active_document(&vault)?, &board_id, &task_id, &today)
}

#[tauri::command]
pub fn list_task_board_refs(
    vault: tauri::State<'_, VaultStore>,
    task_id: String,
) -> Result<Vec<BoardTaskReference>, String> {
    let boards = read_boards(&read_active_document(&vault)?)?;
    let mut references = Vec::new();
    for board in boards {
        for element in board.elements {
            if element.task_id.as_deref() == Some(task_id.as_str()) {
                references.push(BoardTaskReference {
                    board_id: board.id.clone(),
                    board_title: board.title.clone(),
                    element_id: element.id,
                });
            }
        }
    }
    Ok(references)
}

fn decode_png_export(data: &str) -> Result<Vec<u8>, String> {
    const MAX_BYTES: usize = 64 * 1024 * 1024;
    let encoded = data
        .strip_prefix("data:image/png;base64,")
        .ok_or("Exportacao PNG invalida.")?;
    if encoded.len() > (MAX_BYTES + 2) / 3 * 4 {
        return Err("PNG excede 64 MiB.".into());
    }
    let bytes = BASE64
        .decode(encoded)
        .map_err(|_| "Exportacao base64 invalida.")?;
    if bytes.len() > MAX_BYTES
        || bytes.len() < 33
        || !bytes.starts_with(b"\x89PNG\r\n\x1a\n")
        || bytes[8..12] != 13_u32.to_be_bytes()
        || &bytes[12..16] != b"IHDR"
    {
        return Err("Cabecalho PNG invalido.".into());
    }
    let width = u32::from_be_bytes(
        bytes[16..20]
            .try_into()
            .map_err(|_| "Largura PNG invalida.")?,
    );
    let height = u32::from_be_bytes(
        bytes[20..24]
            .try_into()
            .map_err(|_| "Altura PNG invalida.")?,
    );
    if width == 0
        || height == 0
        || width > 8192
        || height > 8192
        || u64::from(width) * u64::from(height) > 64_000_000
    {
        return Err("Exportacao excede 8192 pixels por lado ou 64 megapixels.".into());
    }
    Ok(bytes)
}

/// Writes only the explicit PNG destination chosen through the native save dialog.
#[tauri::command]
pub fn export_board_png(path: String, data: String) -> Result<(), String> {
    let path = std::path::PathBuf::from(path);
    if !path.is_absolute()
        || !path
            .extension()
            .is_some_and(|extension| extension.to_string_lossy().eq_ignore_ascii_case("png"))
    {
        return Err("Selecione um caminho absoluto com extensao .png.".into());
    }
    let bytes = decode_png_export(&data)?;
    std::fs::write(path, bytes).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn element() -> BoardElement {
        BoardElement {
            id: "element-1".into(),
            kind: "question".into(),
            x: 0.0,
            y: 0.0,
            angle: 0.0,
            width: 200.0,
            height: 100.0,
            text: "Como melhorar?".into(),
            color: "neutral".into(),
            stroke_style: BoardStrokeStyle::Clean,
            draw_brush: None,
            stroke_width: None,
            opacity: 1.0,
            stroke_color: None,
            fill_color: None,
            fill_style: None,
            sketch: None,
            group_id: None,
            text_highlight: BoardTextHighlight::None,
            text_annotation: None,
            text_font: BoardTextFont::Sans,
            text_background: BoardTextBackground::None,
            text_align: BoardTextAlign::Left,
            text_vertical_align: BoardTextVerticalAlign::Top,
            text_auto_width: false,
            rich_text: None,
            resolved: false,
            points: vec![],
            start_id: None,
            end_id: None,
            task_id: None,
            image_data: None,
        }
    }
    fn document() -> Value {
        json!({"schemaVersion": 1, "tasks": [], "lifecycleEvents": []})
    }
    fn create(document: &mut Value) -> Board {
        create_in_document(
            document,
            CreateBoardInput {
                scenes: vec![],
                background: BoardBackground::Plain,
                color_scheme: BoardColorScheme::Light,
                kind: BoardKind::Board,
                title: "Refinamento".into(),
                elements: vec![element()],
            },
        )
        .unwrap()
    }

    #[test]
    fn legacy_text_elements_keep_fixed_width() {
        let mut document = document();
        create(&mut document);
        document["boards"][0]["elements"][0]
            .as_object_mut()
            .unwrap()
            .remove("textAutoWidth");
        let boards = read_boards(&document).unwrap();
        assert!(!boards[0].elements[0].text_auto_width);
        assert!(boards[0].elements[0].rich_text.is_none());
    }

    fn scene() -> BoardScene {
        BoardScene {
            id: "scene-1".into(),
            title: "Overview".into(),
            x: -120.0,
            y: 40.0,
            width: 1600.0,
            height: 900.0,
            aspect_ratio: BoardSceneAspectRatio::Wide,
        }
    }

    #[test]
    fn scenes_migrate_roundtrip_and_follow_revision_and_lock_guards() {
        let mut document = document();
        let board = create(&mut document);
        document["boards"][0]
            .as_object_mut()
            .unwrap()
            .remove("scenes");
        let before = document.clone();
        assert!(read_boards(&document).unwrap()[0].scenes.is_empty());
        assert_eq!(document, before);
        let mut input = save_input(&board, None);
        input.scenes = Some(vec![scene()]);
        let saved = save_in_document(&mut document, input).unwrap();
        assert_eq!(saved.scenes, vec![scene()]);
        assert_eq!(read_boards(&document).unwrap()[0], saved);
        assert!(serde_json::to_value(board_summary(saved.clone()))
            .unwrap()
            .get("scenes")
            .is_none());
        let mut stale = save_input(&board, None);
        stale.scenes = Some(vec![]);
        assert!(save_in_document(&mut document, stale).is_err());
        let locked = save_in_document(&mut document, save_input(&saved, Some(true))).unwrap();
        assert_eq!(locked.scenes, saved.scenes);
        let before = document.clone();
        let mut edit = save_input(&locked, Some(false));
        edit.scenes = Some(vec![]);
        assert!(save_in_document(&mut document, edit).is_err());
        assert_eq!(document, before);
        let unlocked = save_in_document(&mut document, save_input(&locked, Some(false))).unwrap();
        let mut clear = save_input(&unlocked, None);
        clear.scenes = Some(vec![]);
        assert!(save_in_document(&mut document, clear)
            .unwrap()
            .scenes
            .is_empty());
    }

    #[test]
    fn creating_a_paper_preserves_ordered_scenes_and_omitted_saves_are_noops() {
        let mut document = document();
        let mut second = scene();
        second.id = "scene-2".into();
        second.aspect_ratio = BoardSceneAspectRatio::Free;
        let input: CreateBoardInput = serde_json::from_value(json!({
            "title": "Presentation", "kind": "paper", "elements": [],
            "scenes": [second, scene()]
        }))
        .unwrap();
        let board = create_in_document(&mut document, input).unwrap();
        assert_eq!(board.scenes[0].id, "scene-2");
        assert_eq!(board.scenes[1].id, "scene-1");
        let before = document.clone();
        assert_eq!(
            save_in_document(&mut document, save_input(&board, None)).unwrap(),
            board
        );
        assert_eq!(document, before);
    }

    #[test]
    fn invalid_scenes_never_mutate_the_document() {
        let mut invalid = vec![vec![scene(); 101], vec![scene(); 2]];
        for field in 0..6 {
            let mut item = scene();
            match field {
                0 => item.width = 0.0,
                1 => item.height = -1.0,
                2 => item.x = f64::NAN,
                3 => item.y = 1_000_001.0,
                4 => item.title = "x".repeat(201),
                _ => item.id = "bad/id".into(),
            }
            invalid.push(vec![item]);
        }
        for scenes in invalid {
            let mut document = document();
            let board = create(&mut document);
            let before = document.clone();
            let mut input = save_input(&board, None);
            input.scenes = Some(scenes);
            assert!(save_in_document(&mut document, input).is_err());
            assert_eq!(document, before);
        }
    }

    fn save_input(board: &Board, locked: Option<bool>) -> SaveBoardInput {
        SaveBoardInput {
            scenes: None,
            id: board.id.clone(),
            title: board.title.clone(),
            elements: board.elements.clone(),
            expected_revision: board.revision,
            background: None,
            color_scheme: None,
            locked,
        }
    }

    #[test]
    fn paper_lock_defaults_read_only_and_roundtrips_with_explicit_unlock() {
        let mut document = document();
        let board = create(&mut document);
        document["boards"][0]
            .as_object_mut()
            .unwrap()
            .remove("locked");
        let before = document.clone();
        assert!(!read_boards(&document).unwrap()[0].locked);
        assert_eq!(document, before);
        let locked = save_in_document(&mut document, save_input(&board, Some(true))).unwrap();
        assert!(locked.locked);
        assert_eq!(locked.revision, 2);
        assert!(board_summary(locked.clone()).locked);
        assert_eq!(read_boards(&document).unwrap()[0], locked);
        let before = document.clone();
        assert_eq!(
            save_in_document(&mut document, save_input(&locked, None)).unwrap(),
            locked
        );
        assert_eq!(document, before);
        let unlocked = save_in_document(&mut document, save_input(&locked, Some(false))).unwrap();
        assert!(!unlocked.locked);
        assert_eq!(unlocked.revision, 3);
        assert_eq!(read_boards(&document).unwrap()[0], unlocked);
    }

    #[test]
    fn locked_paper_rejects_content_delete_and_element_link_without_mutation() {
        let mut document = document();
        let board = create(&mut document);
        let locked = save_in_document(&mut document, save_input(&board, Some(true))).unwrap();
        let before = document.clone();
        for unlock in [None, Some(false)] {
            for field in ["title", "elements", "background", "scheme"] {
                let mut input = save_input(&locked, unlock);
                match field {
                    "title" => input.title = "Changed".into(),
                    "elements" => input.elements[0].x = 123.0,
                    "background" => input.background = Some(BoardBackground::Ruled),
                    _ => input.color_scheme = Some(BoardColorScheme::Dark),
                }
                assert!(save_in_document(&mut document, input).is_err());
                assert_eq!(document, before);
            }
        }
        assert!(delete_in_document(&mut document, &locked.id, locked.revision).is_err());
        assert_eq!(document, before);
        assert!(create_task_link(
            &mut document,
            &locked.id,
            "element-1",
            locked.revision,
            "locked-operation",
            "Action".into(),
            None
        )
        .is_err());
        assert_eq!(document, before);
        let unlocked = save_in_document(&mut document, save_input(&locked, Some(false))).unwrap();
        let mut input = save_input(&unlocked, None);
        input.title = "Now editable".into();
        assert!(save_in_document(&mut document, input).is_ok());
    }

    #[test]
    fn legacy_stroke_presentation_defaults_without_hydration_writes() {
        let mut document = document();
        create(&mut document);
        let value = document["boards"][0]["elements"][0]
            .as_object_mut()
            .unwrap();
        for field in ["strokeWidth", "opacity", "strokeColor"] {
            value.remove(field);
        }
        let before = document.clone();
        let element = read_boards(&document).unwrap().remove(0).elements.remove(0);
        assert_eq!(element.stroke_width, None);
        assert_eq!(element.opacity, 1.0);
        assert_eq!(element.stroke_color, None);
        assert_eq!(document, before);
    }

    #[test]
    fn legacy_fill_defaults_without_hydration_writes() {
        for explicit_null in [false, true] {
            let mut document = document();
            create(&mut document);
            if explicit_null {
                document["boards"][0]["elements"][0]["fillColor"] = Value::Null;
            }
            let before = document.clone();
            assert!(read_boards(&document).unwrap()[0].elements[0]
                .fill_color
                .is_none());
            assert_eq!(document, before);
        }
    }

    #[test]
    fn straight_lines_roundtrip_signed_and_zero_axis_dimensions() {
        for (width, height) in [(100.0, 0.0), (0.0, -100.0), (-100.0, 75.0)] {
            let mut document = document();
            let board = create(&mut document);
            let mut item = element();
            item.kind = "line".into();
            item.width = width;
            item.height = height;
            let saved = save_in_document(
                &mut document,
                SaveBoardInput {
                    scenes: None,
                    locked: None,
                    background: None,
                    color_scheme: None,
                    id: board.id,
                    title: board.title,
                    elements: vec![item.clone()],
                    expected_revision: board.revision,
                },
            )
            .unwrap();
            assert_eq!(saved.elements[0], item);
            assert_eq!(read_boards(&document).unwrap()[0], saved);
            item.start_id = Some("other".into());
            let mut invalid = saved;
            invalid.elements = vec![item];
            assert!(validate_board(&invalid).is_err());
        }
    }

    #[test]
    fn shape_fill_roundtrip_is_independent_from_stroke_and_palette() {
        for kind in [
            "rectangle",
            "ellipse",
            "triangle",
            "hexagon",
            "frame",
            "note",
            "question",
            "decision",
            "task",
            "text",
        ] {
            for color in ["transparent", "#aA12F0"] {
                let mut document = document();
                let board = create(&mut document);
                let mut item = element();
                item.kind = kind.into();
                item.text_background = BoardTextBackground::Rectangle;
                item.fill_color = Some(color.into());
                item.stroke_color = Some("#123456".into());
                let saved = save_in_document(
                    &mut document,
                    SaveBoardInput {
                        scenes: None,
                        locked: None,
                        background: None,
                        color_scheme: None,
                        id: board.id,
                        title: board.title,
                        elements: vec![item.clone()],
                        expected_revision: board.revision,
                    },
                )
                .unwrap();
                assert_eq!(saved.elements[0], item);
                assert_eq!(read_boards(&document).unwrap()[0], saved);
            }
        }
    }

    #[test]
    fn groups_roundtrip_and_invalid_ids_never_mutate_the_document() {
        let mut document = document();
        let board = create(&mut document);
        let mut first = element();
        first.group_id = Some("group-one".into());
        let mut second = first.clone();
        second.id = "group-member-two".into();
        let saved = save_in_document(
            &mut document,
            SaveBoardInput {
                scenes: None,
                locked: None,
                background: None,
                color_scheme: None,
                id: board.id,
                title: board.title,
                elements: vec![first, second],
                expected_revision: board.revision,
            },
        )
        .unwrap();
        assert_eq!(read_boards(&document).unwrap()[0], saved);
        assert!(saved
            .elements
            .iter()
            .all(|e| e.group_id.as_deref() == Some("group-one")));
        let before = document.clone();
        for invalid in ["".to_string(), " ".to_string(), "x".repeat(101)] {
            let mut elements = saved.elements.clone();
            elements[0].group_id = Some(invalid);
            assert!(save_in_document(
                &mut document,
                SaveBoardInput {
                    scenes: None,
                    locked: None,
                    background: None,
                    color_scheme: None,
                    id: saved.id.clone(),
                    title: saved.title.clone(),
                    elements,
                    expected_revision: saved.revision,
                }
            )
            .is_err());
            assert_eq!(document, before);
        }
        assert!(serde_json::to_value(element())
            .unwrap()
            .get("groupId")
            .is_none());
    }

    #[test]
    fn sketch_options_roundtrip_and_validate_without_mutation() {
        let mut document = document();
        let board = create(&mut document);
        let mut item = element();
        item.kind = "rectangle".into();
        item.sketch = Some(BoardSketchOptions {
            stroke_pattern: BoardStrokePattern::Dotted,
            roughness: 1.5,
            bowing: 0.5,
            hachure_angle: 35.0,
            hachure_gap: 12.0,
        });
        let saved = save_in_document(
            &mut document,
            SaveBoardInput {
                scenes: None,
                locked: None,
                background: None,
                color_scheme: None,
                id: board.id,
                title: board.title,
                elements: vec![item.clone()],
                expected_revision: board.revision,
            },
        )
        .unwrap();
        assert_eq!(read_boards(&document).unwrap()[0], saved);
        assert_eq!(saved.elements[0], item);
        let before = document.clone();
        for (roughness, bowing, angle, gap) in [
            (-1.0, 1.0, 0.0, 5.0),
            (1.0, 3.0, 0.0, 5.0),
            (1.0, 1.0, 91.0, 5.0),
            (1.0, 1.0, 0.0, 1.0),
        ] {
            let settings = item.sketch.as_mut().unwrap();
            settings.roughness = roughness;
            settings.bowing = bowing;
            settings.hachure_angle = angle;
            settings.hachure_gap = gap;
            assert!(save_in_document(
                &mut document,
                SaveBoardInput {
                    scenes: None,
                    locked: None,
                    background: None,
                    color_scheme: None,
                    id: saved.id.clone(),
                    title: saved.title.clone(),
                    elements: vec![item.clone()],
                    expected_revision: saved.revision,
                }
            )
            .is_err());
            assert_eq!(document, before);
        }
        assert!(serde_json::to_value(element())
            .unwrap()
            .get("sketch")
            .is_none());
        let mut invalid = serde_json::to_value(saved.elements[0].clone()).unwrap();
        invalid["sketch"]["strokePattern"] = json!("unknown");
        assert!(serde_json::from_value::<BoardElement>(invalid).is_err());
    }

    #[test]
    fn fill_patterns_roundtrip_and_unknown_values_are_rejected() {
        for pattern in [
            BoardFillStyle::Solid,
            BoardFillStyle::Hachure,
            BoardFillStyle::CrossHatch,
            BoardFillStyle::Dots,
            BoardFillStyle::Zigzag,
        ] {
            let mut document = document();
            let board = create(&mut document);
            let mut item = element();
            item.kind = "rectangle".into();
            item.fill_color = Some("#123456".into());
            item.fill_style = Some(pattern);
            let saved = save_in_document(
                &mut document,
                SaveBoardInput {
                    scenes: None,
                    locked: None,
                    background: None,
                    color_scheme: None,
                    id: board.id,
                    title: board.title,
                    elements: vec![item.clone()],
                    expected_revision: board.revision,
                },
            )
            .unwrap();
            assert_eq!(saved.elements[0], item);
            assert_eq!(read_boards(&document).unwrap()[0], saved);
        }
        let mut legacy = serde_json::to_value(element()).unwrap();
        assert!(legacy.get("fillStyle").is_none());
        legacy["fillStyle"] = json!("unknown-pattern");
        assert!(serde_json::from_value::<BoardElement>(legacy).is_err());
    }

    #[test]
    fn unsupported_or_invalid_fills_reject_without_mutation() {
        for (kind, color) in [
            ("draw", "transparent"),
            ("image", "#123456"),
            ("arrow", "#123456"),
            ("text", "#123456"),
            ("rectangle", "red"),
            ("rectangle", "#fff"),
            ("rectangle", "#12345678"),
            ("rectangle", "url(example)"),
            ("rectangle", "#ZZ1234"),
            ("rectangle", ""),
        ] {
            let mut document = document();
            let board = create(&mut document);
            let before = document.clone();
            let mut item = element();
            item.kind = kind.into();
            item.fill_color = Some(color.into());
            assert!(save_in_document(
                &mut document,
                SaveBoardInput {
                    scenes: None,
                    locked: None,
                    background: None,
                    color_scheme: None,
                    id: board.id,
                    title: board.title,
                    elements: vec![item],
                    expected_revision: board.revision,
                }
            )
            .is_err());
            assert_eq!(document, before);
        }
    }

    #[test]
    fn stroke_presentation_roundtrip_preserves_legacy_fields() {
        for (width, opacity, color) in [(0.5, 0.05, "#aA12F0"), (32.0, 1.0, "#000000")] {
            let mut document = document();
            let board = create(&mut document);
            let mut elements = board.elements.clone();
            elements[0].stroke_width = Some(width);
            elements[0].opacity = opacity;
            elements[0].stroke_color = Some(color.into());
            let saved = save_in_document(
                &mut document,
                SaveBoardInput {
                    scenes: None,
                    locked: None,
                    background: None,
                    color_scheme: None,
                    id: board.id,
                    title: board.title,
                    elements: elements.clone(),
                    expected_revision: board.revision,
                },
            )
            .unwrap();
            assert_eq!(saved.elements, elements);
            assert_eq!(read_boards(&document).unwrap()[0], saved);
            let mut original_fields = saved.elements[0].clone();
            original_fields.stroke_width = None;
            original_fields.opacity = 1.0;
            original_fields.stroke_color = None;
            assert_eq!(original_fields, element());
        }
    }

    #[test]
    fn invalid_stroke_presentation_is_rejected_without_document_mutation() {
        let mut invalid_elements = vec![];
        for width in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY, 0.49, 32.01] {
            let mut item = element();
            item.stroke_width = Some(width);
            invalid_elements.push(item);
        }
        for opacity in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY, 0.049, 1.01] {
            let mut item = element();
            item.opacity = opacity;
            invalid_elements.push(item);
        }
        for color in [
            "#fff",
            "red",
            "#zz1234",
            "#123456;",
            "url(example)",
            "",
            "#1234567",
        ] {
            let mut item = element();
            item.stroke_color = Some(color.into());
            invalid_elements.push(item);
        }
        for item in invalid_elements {
            let mut document = document();
            let board = create(&mut document);
            let before = document.clone();
            assert!(save_in_document(
                &mut document,
                SaveBoardInput {
                    scenes: None,
                    locked: None,
                    background: None,
                    color_scheme: None,
                    id: board.id,
                    title: board.title,
                    elements: vec![item],
                    expected_revision: board.revision
                }
            )
            .is_err());
            assert_eq!(document, before);
        }
    }

    #[test]
    fn legacy_elements_default_to_unrotated_without_read_mutation() {
        let mut document = document();
        create(&mut document);
        document["boards"][0]["elements"][0]
            .as_object_mut()
            .unwrap()
            .remove("angle");
        let before = document.clone();
        assert_eq!(read_boards(&document).unwrap()[0].elements[0].angle, 0.0);
        assert_eq!(document, before);
    }

    #[test]
    fn element_rotation_roundtrip_preserves_other_payload_fields() {
        for angle in [
            -std::f64::consts::TAU,
            -1.25,
            0.0,
            1.25,
            std::f64::consts::TAU,
        ] {
            let mut document = document();
            let board = create(&mut document);
            let mut elements = board.elements.clone();
            elements[0].angle = angle;
            let saved = save_in_document(
                &mut document,
                SaveBoardInput {
                    scenes: None,
                    locked: None,
                    background: None,
                    color_scheme: None,
                    id: board.id.clone(),
                    title: board.title.clone(),
                    elements,
                    expected_revision: board.revision,
                },
            )
            .unwrap();
            assert_eq!(read_boards(&document).unwrap()[0], saved);
            assert_eq!(saved.elements[0].angle, angle);
            let mut original_fields = saved.elements[0].clone();
            original_fields.angle = 0.0;
            assert_eq!(original_fields, board.elements[0]);
        }
    }

    #[test]
    fn invalid_rotation_is_rejected_before_document_mutation() {
        for angle in [
            f64::NAN,
            f64::INFINITY,
            f64::NEG_INFINITY,
            std::f64::consts::TAU + 0.1,
            -std::f64::consts::TAU - 0.1,
        ] {
            let mut document = document();
            let board = create(&mut document);
            let before = document.clone();
            let mut elements = board.elements;
            elements[0].angle = angle;
            assert!(save_in_document(
                &mut document,
                SaveBoardInput {
                    scenes: None,
                    locked: None,
                    background: None,
                    color_scheme: None,
                    id: board.id,
                    title: board.title,
                    elements,
                    expected_revision: board.revision,
                }
            )
            .is_err());
            assert_eq!(document, before);
        }
    }

    fn official_task(document: &mut Value) -> String {
        let input =
            serde_json::from_value(json!({"title":"Anotacao", "notes":"Notas preservadas"}))
                .unwrap();
        tasks::create_task_in_document(document, input).unwrap()
    }

    #[test]
    fn legacy_boards_default_kind_and_missing_links_are_read_only() {
        let mut document = document();
        assert!(read_paper_links(&document).unwrap().is_empty());
        assert!(task_papers_from_document(&document, "missing")
            .unwrap()
            .is_empty());
        assert!(document.get("paperLinks").is_none());
        create(&mut document);
        document["boards"][0]
            .as_object_mut()
            .unwrap()
            .remove("kind");
        let before = document.clone();
        assert_eq!(read_boards(&document).unwrap()[0].kind, BoardKind::Board);
        assert_eq!(document, before);
        let input: CreateBoardInput =
            serde_json::from_value(json!({"title":"Legado","elements":[]})).unwrap();
        assert_eq!(input.kind, BoardKind::Board);
        assert!(serde_json::from_value::<CreateBoardInput>(
            json!({"kind":"unknown","title":"X","elements":[]})
        )
        .is_err());
    }

    #[test]
    fn task_paper_creation_is_atomic_idempotent_and_preserves_task_domains() {
        let mut document = document();
        let task_id = official_task(&mut document);
        let task_before = document["tasks"].clone();
        let lifecycle_before = document["lifecycleEvents"].clone();
        let before = document.clone();
        assert!(
            create_paper_in_document(&mut document, &task_id, " ".into(), "invalid-title").is_err()
        );
        assert_eq!(document, before);
        let paper =
            create_paper_in_document(&mut document, &task_id, "Ideias".into(), "paper-operation")
                .unwrap();
        assert_eq!(paper.kind, BoardKind::Paper);
        assert!(paper.elements.is_empty());
        assert_eq!(document["tasks"], task_before);
        assert_eq!(document["lifecycleEvents"], lifecycle_before);
        let before_retry = document.clone();
        assert_eq!(
            create_paper_in_document(
                &mut document,
                &task_id,
                "Outro titulo".into(),
                "paper-operation"
            )
            .unwrap(),
            paper
        );
        assert_eq!(document, before_retry);
        let other_id = official_task(&mut document);
        let before_error = document.clone();
        assert!(create_paper_in_document(
            &mut document,
            &other_id,
            "Outro".into(),
            "paper-operation"
        )
        .is_err());
        assert_eq!(document, before_error);
        assert!(create_paper_in_document(
            &mut document,
            "missing",
            "Outro".into(),
            "missing-operation"
        )
        .is_err());
        assert_eq!(document, before_error);
    }

    #[test]
    fn paper_attachments_are_references_and_noop_does_not_write() {
        let mut document = document();
        let task_id = official_task(&mut document);
        let other_id = official_task(&mut document);
        let paper = create_paper_in_document(&mut document, &task_id, "Ideias".into(), "operation")
            .unwrap();
        attach_paper_in_document(&mut document, &other_id, &paper.id).unwrap();
        let before = document.clone();
        attach_paper_in_document(&mut document, &task_id, &paper.id).unwrap();
        assert_eq!(document, before);
        assert_eq!(
            task_papers_from_document(&document, &task_id)
                .unwrap()
                .len(),
            1
        );
        detach_paper_in_document(&mut document, &task_id, &paper.id).unwrap();
        assert!(task_papers_from_document(&document, &task_id)
            .unwrap()
            .is_empty());
        assert_eq!(
            task_papers_from_document(&document, &other_id)
                .unwrap()
                .len(),
            1
        );
        assert_eq!(read_boards(&document).unwrap()[0], paper);
        assert_eq!(document["tasks"], before["tasks"]);
        let detached = document.clone();
        detach_paper_in_document(&mut document, &task_id, &paper.id).unwrap();
        assert_eq!(document, detached);
        let board = create(&mut document);
        attach_paper_in_document(&mut document, &task_id, &board.id).unwrap();
        let before_invalid = document.clone();
        assert!(attach_paper_in_document(&mut document, &task_id, "missing").is_err());
        assert!(attach_paper_in_document(&mut document, "missing", &paper.id).is_err());
        assert_eq!(document, before_invalid);
    }

    #[test]
    fn archived_paper_context_remains_visible_and_deleted_entities_are_filtered() {
        let mut document = document();
        let task_id = official_task(&mut document);
        let paper = create_paper_in_document(&mut document, &task_id, "Ideias".into(), "operation")
            .unwrap();
        document["tasks"][0]["archivedAt"] = json!("2026-10-13T00:00:00Z");
        document["tasks"][0]["status"] = json!("completed");
        assert_eq!(
            task_papers_from_document(&document, &task_id)
                .unwrap()
                .len(),
            1
        );
        assert_eq!(
            paper_contexts_from_document(&document, &paper.id, "2026-10-13")
                .unwrap()
                .len(),
            1
        );
        document["tasks"] = json!([]);
        let before = document.clone();
        assert!(task_papers_from_document(&document, &task_id)
            .unwrap()
            .is_empty());
        assert!(
            paper_contexts_from_document(&document, &paper.id, "2026-10-13")
                .unwrap()
                .is_empty()
        );
        assert_eq!(document, before);
        delete_in_document(&mut document, &paper.id, paper.revision).unwrap();
        assert!(read_paper_links(&document).unwrap().is_empty());
        assert!(read_boards(&document).unwrap().is_empty());
        assert!(
            create_paper_in_document(&mut document, &task_id, "Ideias".into(), "operation")
                .is_err()
        );
    }

    #[test]
    fn deleting_task_attachment_references_preserves_papers_other_tasks_and_retry_history() {
        let mut document = document();
        let absent = document.clone();
        remove_task_paper_links(&mut document, "missing").unwrap();
        assert_eq!(document, absent);
        let task_id = official_task(&mut document);
        let other_id = official_task(&mut document);
        document["tasks"][1]["archivedAt"] = json!("2026-10-13T00:00:00Z");
        document["tasks"][1]["status"] = json!("completed");
        let paper =
            create_paper_in_document(&mut document, &task_id, "Ideias".into(), "delete-operation")
                .unwrap();
        attach_paper_in_document(&mut document, &other_id, &paper.id).unwrap();
        let before = document.clone();
        remove_task_paper_links(&mut document, &task_id).unwrap();
        assert_eq!(read_paper_links(&document).unwrap().len(), 1);
        assert_eq!(read_paper_links(&document).unwrap()[0].task_id, other_id);
        assert_eq!(document["boards"], before["boards"]);
        assert_eq!(document["tasks"], before["tasks"]);
        assert_eq!(
            document["paperCreateOperations"],
            before["paperCreateOperations"]
        );
        assert_eq!(
            task_papers_from_document(&document, &other_id)
                .unwrap()
                .len(),
            1
        );
        let cleaned = document.clone();
        remove_task_paper_links(&mut document, &task_id).unwrap();
        assert_eq!(document, cleaned);
    }

    #[test]
    fn paper_task_details_require_exact_attachment_and_include_archived_checklist() {
        let mut document = document();
        let task_id = official_task(&mut document);
        let other_id = official_task(&mut document);
        let paper =
            create_paper_in_document(&mut document, &task_id, "Ideias".into(), "details-paper")
                .unwrap();
        document["tasks"][0]["archivedAt"] = json!("2026-10-13T00:00:00Z");
        document["tasks"][0]["status"] = json!("completed");
        document["checklistItems"] = json!([
            {"id":"paper-step","taskId":task_id,"title":"Etapa","status":"completed","sortOrder":0,"completedAt":"2026-10-13T00:00:00Z","createdAt":"2026-10-13T00:00:00Z","updatedAt":"2026-10-13T00:00:00Z"},
            {"id":"other-step","taskId":other_id,"title":"Outra etapa","status":"pending","sortOrder":0,"completedAt":null,"createdAt":"2026-10-13T00:00:00Z","updatedAt":"2026-10-13T00:00:00Z"}
        ]);
        let result = serde_json::to_value(
            task_details_from_document(&document, &paper.id, &task_id, "2026-10-13").unwrap(),
        )
        .unwrap();
        assert_eq!(result["total"], 1);
        assert_eq!(result["tasks"][0]["id"], task_id);
        assert_eq!(result["checklistItems"].as_array().unwrap().len(), 1);
        assert_eq!(result["checklistItems"][0]["id"], "paper-step");
        assert!(task_details_from_document(&document, &paper.id, &other_id, "2026-10-13").is_err());
        detach_paper_in_document(&mut document, &task_id, &paper.id).unwrap();
        assert!(task_details_from_document(&document, &paper.id, &task_id, "2026-10-13").is_err());
        let board = create(&mut document);
        document["paperLinks"] =
            json!([{"taskId":task_id,"paperId":board.id,"createdAt":"2026-10-13T00:00:00Z"}]);
        assert_eq!(
            task_details_from_document(&document, &board.id, &task_id, "2026-10-13")
                .unwrap()
                .total,
            1
        );
    }

    #[test]
    fn legacy_board_is_a_paper_without_migration_or_content_loss() {
        let mut document = document();
        let task_id = official_task(&mut document);
        let board = create(&mut document);
        document["boards"][0]
            .as_object_mut()
            .unwrap()
            .remove("kind");
        let legacy_content = document["boards"].clone();
        let before_read = document.clone();
        assert_eq!(
            ensure_paper(&document, &board.id).unwrap().elements,
            board.elements
        );
        assert!(task_papers_from_document(&document, &task_id)
            .unwrap()
            .is_empty());
        assert!(
            paper_contexts_from_document(&document, &board.id, "2026-10-13")
                .unwrap()
                .is_empty()
        );
        assert_eq!(document, before_read);
        attach_paper_in_document(&mut document, &task_id, &board.id).unwrap();
        let before_join_read = document.clone();
        let summaries = task_papers_from_document(&document, &task_id).unwrap();
        assert_eq!(summaries.len(), 1);
        assert_eq!(summaries[0].id, board.id);
        assert_eq!(
            paper_contexts_from_document(&document, &board.id, "2026-10-13")
                .unwrap()
                .len(),
            1
        );
        assert_eq!(
            task_details_from_document(&document, &board.id, &task_id, "2026-10-13")
                .unwrap()
                .total,
            1
        );
        assert_eq!(document, before_join_read);
        assert_eq!(document["boards"], legacy_content);
        detach_paper_in_document(&mut document, &task_id, &board.id).unwrap();
        assert_eq!(document["boards"], legacy_content);
    }

    #[test]
    fn artistic_brush_legacy_defaults_do_not_mutate_or_hydrate_payload() {
        let mut document = document();
        create(&mut document);
        document["boards"][0]["elements"][0]["points"] = json!([{"x":1,"y":2}]);
        let original = document.clone();
        let boards = read_boards(&document).unwrap();
        assert!(boards[0].elements[0].draw_brush.is_none());
        assert!(boards[0].elements[0].points[0].pressure.is_none());
        assert_eq!(document, original);
        let value = serde_json::to_value(&boards[0].elements[0]).unwrap();
        assert!(value.get("drawBrush").is_none());
        assert!(value["points"][0].get("pressure").is_none());
    }

    #[test]
    fn artistic_brushes_and_pressure_roundtrip_preserves_fountain_and_legacy_tools() {
        for brush in [
            BoardDrawBrush::Graphite,
            BoardDrawBrush::Fountain,
            BoardDrawBrush::Ink,
            BoardDrawBrush::Charcoal,
            BoardDrawBrush::Marker,
            BoardDrawBrush::Watercolor,
            BoardDrawBrush::Spray,
        ] {
            let mut document = document();
            let board = create(&mut document);
            let mut elements = board.elements.clone();
            elements[0].kind = "draw".into();
            elements[0].draw_brush = Some(brush);
            elements[0].points = vec![
                BoardPoint {
                    x: 0.0,
                    y: 0.0,
                    pressure: Some(0.0),
                },
                BoardPoint {
                    x: 1.0,
                    y: 2.0,
                    pressure: Some(0.5),
                },
                BoardPoint {
                    x: 3.0,
                    y: 4.0,
                    pressure: Some(1.0),
                },
            ];
            let saved = save_in_document(
                &mut document,
                SaveBoardInput {
                    scenes: None,
                    locked: None,
                    background: None,
                    color_scheme: None,
                    id: board.id,
                    title: board.title,
                    elements,
                    expected_revision: board.revision,
                },
            )
            .unwrap();
            assert_eq!(read_boards(&document).unwrap()[0], saved);
            assert_eq!(saved.elements[0].draw_brush, Some(brush));
            assert_eq!(saved.elements[0].points[1].pressure, Some(0.5));
        }
    }

    #[test]
    fn artistic_brushes_reject_unknown_tools_non_drawing_shapes_and_invalid_pressure() {
        let mut value = serde_json::to_value(element()).unwrap();
        value["drawBrush"] = json!("unknown");
        assert!(serde_json::from_value::<BoardElement>(value).is_err());
        let mut document = document();
        let mut board = create(&mut document);
        for brush in [BoardDrawBrush::Marker, BoardDrawBrush::Fountain] {
            board.elements[0].draw_brush = Some(brush);
            assert!(validate_board(&board).is_err());
        }
        board.elements[0].kind = "draw".into();
        for pressure in [-0.01, 1.01, f64::NAN, f64::INFINITY] {
            board.elements[0].points = vec![BoardPoint {
                x: 0.0,
                y: 0.0,
                pressure: Some(pressure),
            }];
            assert!(validate_board(&board).is_err());
        }
    }

    fn annotation() -> BoardTextAnnotation {
        serde_json::from_value(json!({
            "type":"bracket", "color":"#aA12F0", "strokeWidth":2,
            "padding":5, "iterations":2, "brackets":["left","right"],
            "animate":true, "animationDuration":800, "animationDelay":100,
            "multiline":true
        }))
        .unwrap()
    }

    #[test]
    fn text_annotations_roundtrip_without_changing_legacy_documents() {
        let mut document = document();
        let board = create(&mut document);
        let before = document.clone();
        assert!(read_boards(&document).unwrap()[0].elements[0]
            .text_annotation
            .is_none());
        assert_eq!(document, before);
        let mut elements = board.elements.clone();
        elements[0].kind = "text".into();
        elements[0].text_annotation = Some(annotation());
        let mut rich = rich_text();
        assert!(rich.paragraphs[0].runs[0].annotation.is_none());
        rich.paragraphs[0].runs[0].annotation = Some(annotation());
        elements[0].rich_text = Some(rich);
        let saved = save_in_document(
            &mut document,
            SaveBoardInput {
                scenes: None,
                locked: None,
                background: None,
                color_scheme: None,
                id: board.id,
                title: board.title,
                elements,
                expected_revision: board.revision,
            },
        )
        .unwrap();
        assert_eq!(read_boards(&document).unwrap()[0], saved);
        assert_eq!(saved.elements[0].text_annotation, Some(annotation()));
        assert_eq!(
            saved.elements[0].rich_text.as_ref().unwrap().paragraphs[0].runs[0].annotation,
            Some(annotation())
        );
    }

    #[test]
    fn text_annotation_accepts_every_style_and_rejects_invalid_json() {
        for kind in [
            "underline",
            "box",
            "circle",
            "highlight",
            "strike-through",
            "crossed-off",
            "bracket",
        ] {
            let mut value = serde_json::to_value(annotation()).unwrap();
            value["type"] = json!(kind);
            validate_text_annotation(&serde_json::from_value(value).unwrap()).unwrap();
        }
        for padding in [json!([2, 4]), json!([1, 2, 3, 4])] {
            let mut value = serde_json::to_value(annotation()).unwrap();
            value["padding"] = padding;
            value["rtl"] = json!(true);
            let parsed: BoardTextAnnotation = serde_json::from_value(value).unwrap();
            assert!(parsed.rtl);
            validate_text_annotation(&parsed).unwrap();
        }
        for (field, value) in [
            ("type", json!("unknown")),
            ("brackets", json!(["center"])),
            ("iterations", json!(1.5)),
            ("animationDuration", json!(-1)),
            ("animationDelay", json!(1.5)),
            ("unexpected", json!(true)),
        ] {
            let mut data = serde_json::to_value(annotation()).unwrap();
            data[field] = value;
            assert!(serde_json::from_value::<BoardTextAnnotation>(data).is_err());
        }
    }

    #[test]
    fn text_annotation_validation_covers_element_and_run_metadata() {
        for (field, value) in [
            ("color", json!("url(example)")),
            ("strokeWidth", json!(0.4)),
            ("strokeWidth", json!(8.1)),
            ("padding", json!(-1)),
            ("padding", json!(25)),
            ("iterations", json!(0)),
            ("padding", json!([1])),
            ("padding", json!([1, 2, 3])),
            ("padding", json!([1, 25])),
            ("iterations", json!(5)),
            ("brackets", json!([])),
            ("brackets", json!(["left", "left"])),
            ("animationDuration", json!(99)),
            ("animationDuration", json!(5001)),
            ("animationDelay", json!(5001)),
        ] {
            let mut invalid = serde_json::to_value(annotation()).unwrap();
            invalid[field] = value;
            let annotation: BoardTextAnnotation = serde_json::from_value(invalid).unwrap();
            assert!(validate_text_annotation(&annotation).is_err());
            let mut document = document();
            let mut board = create(&mut document);
            board.elements[0].text_annotation = Some(annotation.clone());
            assert!(validate_board(&board).is_err());
            let mut element = element();
            element.kind = "text".into();
            let mut rich = rich_text();
            rich.paragraphs[0].runs[0].annotation = Some(annotation);
            assert!(validate_rich_text(&element, &rich).is_err());
        }
        for value in [f64::NAN, f64::INFINITY] {
            let mut annotation = annotation();
            annotation.stroke_width = value;
            assert!(validate_text_annotation(&annotation).is_err());
            annotation.stroke_width = 2.0;
            annotation.padding = BoardAnnotationPadding::Uniform(value);
            assert!(validate_text_annotation(&annotation).is_err());
        }
    }

    fn rich_text() -> BoardRichText {
        serde_json::from_value(json!({"paragraphs": [
            {"align":"center","list":"bullet","runs":[
                {"text":"Como melhorar?","bold":true,"italic":false,"underline":true,
                 "font":"handwritten","fontSize":24,"color":"#aA12F0","highlight":"yellow"}
            ]}
        ]}))
        .unwrap()
    }

    #[test]
    fn rich_text_roundtrip_preserves_styles_and_plain_text() {
        let mut document = document();
        let board = create(&mut document);
        let mut elements = board.elements.clone();
        elements[0].kind = "text".into();
        elements[0].rich_text = Some(rich_text());
        let saved = save_in_document(
            &mut document,
            SaveBoardInput {
                scenes: None,
                locked: None,
                background: None,
                color_scheme: None,
                id: board.id,
                title: board.title,
                elements,
                expected_revision: board.revision,
            },
        )
        .unwrap();
        assert_eq!(read_boards(&document).unwrap()[0], saved);
        assert_eq!(saved.elements[0].rich_text, Some(rich_text()));
    }

    #[test]
    fn rich_text_rejects_invalid_styles_and_mismatched_content() {
        let mut element = element();
        element.kind = "text".into();
        for color in ["red", "#fff", "#gg1234", "url(example)", "#123456;"] {
            let mut rich = rich_text();
            rich.paragraphs[0].runs[0].color = color.into();
            assert!(validate_rich_text(&element, &rich).is_err());
        }
        for size in [7.0, 73.0, f64::NAN, f64::INFINITY] {
            let mut rich = rich_text();
            rich.paragraphs[0].runs[0].font_size = size;
            assert!(validate_rich_text(&element, &rich).is_err());
        }
        element.text = "Outro texto".into();
        assert!(validate_rich_text(&element, &rich_text()).is_err());
        element.text = "Como melhorar?".into();
        element.kind = "arrow".into();
        assert!(validate_rich_text(&element, &rich_text()).is_err());
        for (field, value) in [("align", "justify"), ("list", "html")] {
            let mut rich = serde_json::to_value(rich_text()).unwrap();
            rich["paragraphs"][0][field] = json!(value);
            assert!(serde_json::from_value::<BoardRichText>(rich).is_err());
        }
    }

    #[test]
    fn rich_text_enforces_bounded_document_and_newline_mirror() {
        let mut element = element();
        element.kind = "text".into();
        let mut rich = rich_text();
        rich.paragraphs.push(BoardTextParagraph {
            align: BoardTextAlign::Left,
            list: BoardTextList::None,
            runs: vec![],
        });
        element.text.push('\n');
        assert!(validate_rich_text(&element, &rich).is_ok());
        rich.paragraphs = vec![rich.paragraphs[1].clone(); 1001];
        assert!(validate_rich_text(&element, &rich).is_err());
        rich = rich_text();
        rich.paragraphs[0].runs = vec![rich.paragraphs[0].runs[0].clone(); 10_001];
        assert!(validate_rich_text(&element, &rich).is_err());
        rich = rich_text();
        rich.paragraphs[0].runs[0].text = "é".repeat(50_001);
        assert!(validate_rich_text(&element, &rich).is_err());
    }

    #[test]
    fn shape_text_preserves_rich_styles_including_linked_task_references() {
        for kind in [
            "text",
            "note",
            "rectangle",
            "ellipse",
            "triangle",
            "hexagon",
            "frame",
            "question",
            "decision",
            "task",
        ] {
            let mut item = element();
            item.kind = kind.into();
            assert!(validate_rich_text(&item, &rich_text()).is_ok());
        }
        let mut item = element();
        item.kind = "task".into();
        item.task_id = Some("task-1".into());
        assert!(validate_rich_text(&item, &rich_text()).is_ok());
        item.kind = "image".into();
        item.task_id = None;
        assert!(validate_rich_text(&item, &rich_text()).is_err());
    }

    #[test]
    fn automatic_text_width_survives_board_save_and_read() {
        let mut document = document();
        let board = create(&mut document);
        let mut elements = board.elements.clone();
        elements[0].kind = "text".into();
        elements[0].text_auto_width = true;
        let saved = save_in_document(
            &mut document,
            SaveBoardInput {
                scenes: None,
                locked: None,
                background: None,
                color_scheme: None,
                id: board.id,
                title: board.title,
                elements,
                expected_revision: board.revision,
            },
        )
        .unwrap();
        assert!(saved.elements[0].text_auto_width);
        assert_eq!(read_boards(&document).unwrap()[0], saved);
    }

    #[test]
    fn legacy_elements_without_stroke_style_keep_clean_lines() {
        let mut document = document();
        create(&mut document);
        document["boards"][0]["elements"][0]
            .as_object_mut()
            .unwrap()
            .remove("strokeStyle");
        let boards = read_boards(&document).unwrap();
        assert_eq!(boards[0].elements[0].stroke_style, BoardStrokeStyle::Clean);
    }

    #[test]
    fn drawing_stroke_styles_survive_board_save_and_read() {
        for style in [
            BoardStrokeStyle::Pencil,
            BoardStrokeStyle::Pen,
            BoardStrokeStyle::Clean,
        ] {
            let mut document = document();
            let board = create(&mut document);
            let mut elements = board.elements.clone();
            elements[0].stroke_style = style;
            let saved = save_in_document(
                &mut document,
                SaveBoardInput {
                    scenes: None,
                    locked: None,
                    background: None,
                    color_scheme: None,
                    id: board.id,
                    title: board.title,
                    elements,
                    expected_revision: board.revision,
                },
            )
            .unwrap();
            assert_eq!(read_boards(&document).unwrap()[0], saved);
            assert_eq!(saved.elements[0].stroke_style, style);
        }
    }

    #[test]
    fn unsupported_stroke_styles_are_rejected() {
        let mut value = serde_json::to_value(element()).unwrap();
        value["strokeStyle"] = json!("watercolor");
        assert!(serde_json::from_value::<BoardElement>(value).is_err());
    }

    #[test]
    fn legacy_elements_keep_unmarked_sans_text() {
        let mut document = document();
        create(&mut document);
        let value = document["boards"][0]["elements"][0]
            .as_object_mut()
            .unwrap();
        value.remove("textHighlight");
        value.remove("textFont");
        let boards = read_boards(&document).unwrap();
        assert_eq!(
            boards[0].elements[0].text_highlight,
            BoardTextHighlight::None
        );
        assert_eq!(boards[0].elements[0].text_font, BoardTextFont::Sans);
    }

    #[test]
    fn text_presentation_survives_board_save_and_read() {
        for font in [BoardTextFont::Handwritten, BoardTextFont::Sans] {
            for highlight in [
                BoardTextHighlight::None,
                BoardTextHighlight::Yellow,
                BoardTextHighlight::Green,
                BoardTextHighlight::Pink,
                BoardTextHighlight::Blue,
            ] {
                let mut document = document();
                let board = create(&mut document);
                let mut elements = board.elements.clone();
                elements[0].text_font = font;
                elements[0].text_highlight = highlight;
                let saved = save_in_document(
                    &mut document,
                    SaveBoardInput {
                        scenes: None,
                        locked: None,
                        background: None,
                        color_scheme: None,
                        id: board.id,
                        title: board.title,
                        elements,
                        expected_revision: board.revision,
                    },
                )
                .unwrap();
                assert_eq!(read_boards(&document).unwrap()[0], saved);
                assert_eq!(saved.elements[0].text_font, font);
                assert_eq!(saved.elements[0].text_highlight, highlight);
            }
        }
    }

    #[test]
    fn unsupported_text_presentation_is_rejected() {
        for (field, value) in [("textFont", "remote"), ("textHighlight", "orange")] {
            let mut element = serde_json::to_value(element()).unwrap();
            element[field] = json!(value);
            assert!(serde_json::from_value::<BoardElement>(element).is_err());
        }
    }

    #[test]
    fn legacy_text_background_and_alignment_default_without_mutation() {
        let mut value = serde_json::to_value(element()).unwrap();
        for field in ["textBackground", "textAlign", "textVerticalAlign"] {
            value.as_object_mut().unwrap().remove(field);
        }
        let before = value.clone();
        let element: BoardElement = serde_json::from_value(value.clone()).unwrap();
        assert_eq!(element.text_background, BoardTextBackground::None);
        assert_eq!(element.text_align, BoardTextAlign::Left);
        assert_eq!(element.text_vertical_align, BoardTextVerticalAlign::Top);
        assert_eq!(value, before);
        for (field, invalid) in [
            ("textBackground", "image"),
            ("textAlign", "justify"),
            ("textVerticalAlign", "baseline"),
        ] {
            let mut invalid_value = value.clone();
            invalid_value[field] = json!(invalid);
            assert!(serde_json::from_value::<BoardElement>(invalid_value).is_err());
        }
    }

    #[test]
    fn text_background_and_alignment_survive_save_and_read() {
        let mut document = document();
        let board = create(&mut document);
        let mut elements = vec![];
        for background in [
            BoardTextBackground::None,
            BoardTextBackground::Rectangle,
            BoardTextBackground::Ellipse,
        ] {
            for align in [
                BoardTextAlign::Left,
                BoardTextAlign::Center,
                BoardTextAlign::Right,
            ] {
                for vertical_align in [
                    BoardTextVerticalAlign::Top,
                    BoardTextVerticalAlign::Middle,
                    BoardTextVerticalAlign::Bottom,
                ] {
                    let mut item = element();
                    item.id = format!("text-{}", elements.len());
                    item.kind = "text".into();
                    item.text_background = background;
                    item.text_align = align;
                    item.text_vertical_align = vertical_align;
                    elements.push(item);
                }
            }
        }
        let saved = save_in_document(
            &mut document,
            SaveBoardInput {
                scenes: None,
                locked: None,
                background: None,
                color_scheme: None,
                id: board.id,
                title: board.title,
                elements: elements.clone(),
                expected_revision: board.revision,
            },
        )
        .unwrap();
        assert_eq!(saved.elements, elements);
        assert_eq!(read_boards(&document).unwrap()[0], saved);
    }

    #[test]
    fn legacy_crud_preserves_task_data_and_noop_revision() {
        let mut document = document();
        assert!(read_boards(&document).unwrap().is_empty());
        let board = create(&mut document);
        let before = document.clone();
        let saved = save_in_document(
            &mut document,
            SaveBoardInput {
                scenes: None,
                locked: None,
                background: None,
                color_scheme: None,
                id: board.id.clone(),
                title: board.title.clone(),
                elements: board.elements.clone(),
                expected_revision: 1,
            },
        )
        .unwrap();
        assert_eq!(saved.revision, 1);
        assert_eq!(document, before);
        let saved = save_in_document(
            &mut document,
            SaveBoardInput {
                scenes: None,
                locked: None,
                background: None,
                color_scheme: None,
                id: board.id.clone(),
                title: "Novo titulo".into(),
                elements: board.elements.clone(),
                expected_revision: 1,
            },
        )
        .unwrap();
        assert_eq!(saved.revision, 2);
        assert!(save_in_document(
            &mut document,
            SaveBoardInput {
                scenes: None,
                locked: None,
                background: None,
                color_scheme: None,
                id: board.id.clone(),
                title: "Antigo".into(),
                elements: board.elements,
                expected_revision: 1
            }
        )
        .is_err());
        assert_eq!(document["tasks"], json!([]));
        assert!(delete_in_document(&mut document, &board.id, 1).is_err());
        delete_in_document(&mut document, &board.id, 2).unwrap();
        assert!(read_boards(&document).unwrap().is_empty());
    }

    #[test]
    fn rejects_invalid_elements_images_and_versions() {
        let mut document = document();
        let mut board = create(&mut document);
        board.elements[0].x = f64::NAN;
        assert!(validate_board(&board).is_err());
        board.elements[0].x = 0.0;
        board.elements[0].kind = "arrow".into();
        board.elements[0].width = -200.0;
        board.elements[0].height = 0.0;
        assert!(validate_board(&board).is_ok());
        board.elements[0] = element();
        board.elements.push(board.elements[0].clone());
        assert!(validate_board(&board).is_err());
        board.elements.pop();
        board.format_version = 2;
        assert!(validate_board(&board).is_err());
        assert!(validate_image("data:image/svg+xml;base64,PHN2Zz4=").is_err());
        assert!(validate_image("data:image/png;base64,aGVsbG8=").is_err());
        assert!(validate_image("data:image/png;base64,iVBORw0KGgo=").is_ok());
        assert!(validate_image(&format!(
            "data:image/png;base64,{}",
            "A".repeat(MAX_IMAGE_BYTES * 4 / 3 + 100)
        ))
        .is_err());
    }

    #[test]
    fn task_link_is_atomic_in_document_and_retry_is_idempotent() {
        let mut document = document();
        let board = create(&mut document);
        let result = create_task_link(
            &mut document,
            &board.id,
            "element-1",
            1,
            "operation-1",
            "Implementar".into(),
            None,
        )
        .unwrap();
        assert_eq!(
            result.board.elements[0].task_id.as_deref(),
            Some(result.task_id.as_str())
        );
        assert_eq!(document["tasks"][0]["id"], result.task_id);
        assert_eq!(document["lifecycleEvents"][0]["type"], "taskCreated");
        assert!(document["tasks"][0]["dueAt"].is_null());
        let before = document.clone();
        let retry = create_task_link(
            &mut document,
            &board.id,
            "element-1",
            1,
            "operation-1",
            "Implementar".into(),
            None,
        )
        .unwrap();
        assert_eq!(retry.task_id, result.task_id);
        assert_eq!(document, before);
        assert!(create_task_link(
            &mut document,
            &board.id,
            "element-1",
            2,
            "operation-2",
            "Duplicada".into(),
            None
        )
        .is_err());
        assert_eq!(document["tasks"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn empty_task_card_creates_one_official_task_without_changing_source_kind() {
        let mut document = document();
        let mut card = element();
        card.kind = "task".into();
        let board = create_in_document(
            &mut document,
            CreateBoardInput {
                scenes: vec![],
                background: BoardBackground::Plain,
                color_scheme: BoardColorScheme::Light,
                kind: BoardKind::Board,
                title: "Quadro".into(),
                elements: vec![card],
            },
        )
        .unwrap();
        let result = create_task_link(
            &mut document,
            &board.id,
            "element-1",
            1,
            "task-operation",
            "Tarefa".into(),
            None,
        )
        .unwrap();
        assert_eq!(result.board.elements[0].kind, "task");
        let retry = create_task_link(
            &mut document,
            &board.id,
            "element-1",
            1,
            "task-operation",
            "Tarefa".into(),
            None,
        )
        .unwrap();
        assert_eq!(result.task_id, retry.task_id);
        assert_eq!(document["tasks"].as_array().unwrap().len(), 1);
        assert!(create_task_link(
            &mut document,
            &board.id,
            "element-1",
            2,
            "other-operation",
            "Duplicada".into(),
            None
        )
        .is_err());
    }

    #[test]
    fn task_details_include_only_linked_task_and_its_checklist_even_when_archived() {
        let mut document = document();
        let board = create(&mut document);
        let result = create_task_link(
            &mut document,
            &board.id,
            "element-1",
            1,
            "details-operation",
            "Vinculada".into(),
            None,
        )
        .unwrap();
        let other: CreateTaskInput = serde_json::from_value(json!({"title": "Outra"})).unwrap();
        let other_id = tasks::create_task_in_document(&mut document, other).unwrap();
        document["tasks"][0]["archivedAt"] = json!("2026-10-13T00:00:00Z");
        document["tasks"][0]["status"] = json!("completed");
        document["checklistItems"] = json!([
            {"id":"step-1","taskId":result.task_id,"title":"Etapa","status":"completed","sortOrder":0,"completedAt":"2026-10-13T00:00:00Z","createdAt":"2026-10-13T00:00:00Z","updatedAt":"2026-10-13T00:00:00Z"},
            {"id":"other-step","taskId":other_id,"title":"Outra etapa","status":"pending","sortOrder":0,"completedAt":null,"createdAt":"2026-10-13T00:00:00Z","updatedAt":"2026-10-13T00:00:00Z"}
        ]);
        let details = serde_json::to_value(
            task_details_from_document(&document, &board.id, &result.task_id, "2026-10-13")
                .unwrap(),
        )
        .unwrap();
        assert_eq!(details["total"], 1);
        assert_eq!(details["tasks"][0]["id"], result.task_id);
        assert_eq!(details["checklistItems"].as_array().unwrap().len(), 1);
        assert_eq!(details["checklistItems"][0]["id"], "step-1");
        assert!(task_details_from_document(&document, &board.id, &other_id, "2026-10-13").is_err());
        document["tasks"] = json!([]);
        let missing =
            task_details_from_document(&document, &board.id, &result.task_id, "2026-10-13")
                .unwrap();
        assert_eq!(missing.total, 0);
        assert!(missing.checklist_items.is_empty());
    }

    #[test]
    fn png_export_rejects_invalid_headers_and_oversized_dimensions() {
        fn png(width: u32, height: u32) -> String {
            let mut bytes = b"\x89PNG\r\n\x1a\n".to_vec();
            bytes.extend(13_u32.to_be_bytes());
            bytes.extend(b"IHDR");
            bytes.extend(width.to_be_bytes());
            bytes.extend(height.to_be_bytes());
            bytes.extend([8, 6, 0, 0, 0, 0, 0, 0, 0]);
            format!("data:image/png;base64,{}", BASE64.encode(bytes))
        }
        assert!(decode_png_export(&png(100, 200)).is_ok());
        assert!(decode_png_export(&png(0, 200)).is_err());
        assert!(decode_png_export(&png(8193, 200)).is_err());
        assert!(decode_png_export(&png(8192, 8192)).is_err());
        assert!(decode_png_export("data:image/png;base64,aGVsbG8=").is_err());
        assert!(export_board_png("cofre.praxis".into(), png(100, 200)).is_err());
    }

    #[test]
    fn legacy_paper_background_defaults_without_hydration_write() {
        let mut document = document();
        create(&mut document);
        let value = document["boards"][0].as_object_mut().unwrap();
        value.remove("background");
        value.remove("colorScheme");
        let before = document.clone();
        let board = read_boards(&document).unwrap().remove(0);
        assert_eq!(board.background, BoardBackground::Plain);
        assert_eq!(board.color_scheme, BoardColorScheme::Light);
        let summary = serde_json::to_value(board_summary(board)).unwrap();
        assert_eq!(summary["background"], "plain");
        assert_eq!(summary["colorScheme"], "light");
        assert_eq!(document, before);
        let input: CreateBoardInput =
            serde_json::from_value(json!({"title":"Paper", "elements":[]})).unwrap();
        assert_eq!(input.background, BoardBackground::Plain);
        assert_eq!(input.color_scheme, BoardColorScheme::Light);
    }

    #[test]
    fn paper_background_and_color_scheme_roundtrip_and_legacy_save_preserves_them() {
        for background in ["plain", "grid", "ruled", "dots"] {
            for color_scheme in ["light", "dark"] {
                let mut document = document();
                let input = serde_json::from_value(json!({"title":"Paper", "elements":[], "background":background, "colorScheme":color_scheme})).unwrap();
                let board = create_in_document(&mut document, input).unwrap();
                assert_eq!(
                    serde_json::to_value(board_summary(board.clone())).unwrap()["colorScheme"],
                    color_scheme
                );
                assert_eq!(read_boards(&document).unwrap()[0], board);
                let input = serde_json::from_value(json!({"id":board.id, "title":"Novo titulo", "elements":[], "expectedRevision":1})).unwrap();
                let saved = save_in_document(&mut document, input).unwrap();
                assert_eq!(saved.background, board.background);
                assert_eq!(saved.color_scheme, board.color_scheme);
                let input = serde_json::from_value(json!({"id":saved.id, "title":saved.title, "elements":[], "expectedRevision":2, "background":"grid", "colorScheme":"dark"})).unwrap();
                let updated = save_in_document(&mut document, input).unwrap();
                assert_eq!(updated.background, BoardBackground::Grid);
                assert_eq!(updated.color_scheme, BoardColorScheme::Dark);
                assert_eq!(read_boards(&document).unwrap()[0], updated);
            }
        }
    }

    #[test]
    fn unsupported_paper_background_values_are_rejected_before_mutation() {
        for (field, value) in [("background", "image"), ("colorScheme", "system")] {
            let mut document = document();
            let board = create(&mut document);
            let before = document.clone();
            let mut create_input = json!({"title":"Paper", "elements":[]});
            create_input[field] = json!(value);
            assert!(serde_json::from_value::<CreateBoardInput>(create_input).is_err());
            let mut save_input = json!({"id":board.id, "title":board.title, "elements":board.elements, "expectedRevision":board.revision});
            save_input[field] = json!(value);
            assert!(serde_json::from_value::<SaveBoardInput>(save_input).is_err());
            let mut stored_board = serde_json::to_value(board).unwrap();
            stored_board[field] = json!(value);
            assert!(serde_json::from_value::<Board>(stored_board).is_err());
            assert_eq!(document, before);
        }
    }
}
