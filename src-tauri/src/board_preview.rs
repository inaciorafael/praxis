use std::collections::BTreeSet;

use serde::Serialize;

use crate::{
    boards::{self, Board, BoardBackground, BoardColorScheme, BoardElement, BoardPoint},
    vault::VaultStore,
};

const MAX_ELEMENTS: usize = 128;
const MAX_POINTS: usize = 128;
const MAX_TEXT: usize = 256;
const MAX_IMAGE_BYTES: usize = 1024 * 1024;

#[derive(Debug, Serialize)]
pub struct PreviewBounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardPreview {
    id: String,
    revision: u64,
    background: BoardBackground,
    color_scheme: BoardColorScheme,
    elements: Vec<BoardElement>,
    bounds: PreviewBounds,
}

fn sample_indices(length: usize, limit: usize) -> Vec<usize> {
    if length <= limit {
        return (0..length).collect();
    }
    (0..limit).map(|i| i * (length - 1) / (limit - 1)).collect()
}

fn preview_points(points: &[BoardPoint]) -> Vec<BoardPoint> {
    if points.len() <= MAX_POINTS {
        return points.to_vec();
    }
    // Retain geometric extrema alongside uniformly distributed samples and endpoints.
    let mut indices = BTreeSet::from([0, points.len() - 1]);
    for coordinate in [true, false] {
        let value = |i: usize| if coordinate { points[i].x } else { points[i].y };
        let mut low = 0;
        let mut high = 0;
        for i in 1..points.len() {
            if value(i) < value(low) {
                low = i;
            }
            if value(i) > value(high) {
                high = i;
            }
        }
        indices.insert(low);
        indices.insert(high);
    }
    for index in sample_indices(points.len(), MAX_POINTS) {
        if indices.len() == MAX_POINTS {
            break;
        }
        indices.insert(index);
    }
    indices.into_iter().map(|i| points[i].clone()).collect()
}

fn content_bounds(elements: &[BoardElement]) -> PreviewBounds {
    let (mut min_x, mut min_y, mut max_x, mut max_y) = (
        f64::INFINITY,
        f64::INFINITY,
        f64::NEG_INFINITY,
        f64::NEG_INFINITY,
    );
    for element in elements {
        let cx = element.x + element.width / 2.0;
        let cy = element.y + element.height / 2.0;
        let (sin, cos) = element.angle.sin_cos();
        let mut include = |x: f64, y: f64| {
            let dx = x - cx;
            let dy = y - cy;
            let rx = cx + dx * cos - dy * sin;
            let ry = cy + dx * sin + dy * cos;
            if rx.is_finite() && ry.is_finite() {
                let padding = element.stroke_width.unwrap_or(1.0) / 2.0;
                min_x = min_x.min(rx - padding);
                min_y = min_y.min(ry - padding);
                max_x = max_x.max(rx + padding);
                max_y = max_y.max(ry + padding);
            }
        };
        for (x, y) in [
            (element.x, element.y),
            (element.x + element.width, element.y),
            (element.x, element.y + element.height),
            (element.x + element.width, element.y + element.height),
        ] {
            include(x, y);
        }
        if element.kind == "draw" {
            for point in &element.points {
                include(element.x + point.x, element.y + point.y);
            }
        }
    }
    if !min_x.is_finite() {
        return PreviewBounds {
            x: 0.0,
            y: 0.0,
            width: 1.0,
            height: 1.0,
        };
    }
    PreviewBounds {
        x: min_x,
        y: min_y,
        width: (max_x - min_x).max(1.0),
        height: (max_y - min_y).max(1.0),
    }
}

fn make_preview(board: &Board) -> BoardPreview {
    let visible: Vec<BoardElement> = if board.layers.is_empty() {
        board.elements.clone()
    } else {
        board
            .layers
            .iter()
            .filter(|layer| layer.visible && layer.opacity > 0.0)
            .flat_map(|layer| {
                board
                    .elements
                    .iter()
                    .filter(move |element| {
                        element.layer_id.as_deref().unwrap_or("base") == layer.id
                    })
                    .map(move |element| {
                        let mut item = element.clone();
                        item.opacity *= layer.opacity;
                        item
                    })
            })
            .collect()
    };
    let mut image_budget = MAX_IMAGE_BYTES;
    let elements = sample_indices(visible.len(), MAX_ELEMENTS)
        .into_iter()
        .map(|index| {
            let mut element = visible[index].clone();
            element.text = element.text.chars().take(MAX_TEXT).collect();
            element.points = preview_points(&element.points);
            if let Some(annotation) = &mut element.text_annotation {
                annotation.animate = false;
            }
            if let Some(rich) = &mut element.rich_text {
                rich.paragraphs.truncate(4);
                let mut characters = MAX_TEXT;
                let mut runs = 8;
                for paragraph in &mut rich.paragraphs {
                    paragraph.runs.truncate(runs);
                    runs -= paragraph.runs.len();
                    for run in &mut paragraph.runs {
                        if let Some(annotation) = &mut run.annotation {
                            annotation.animate = false;
                        }
                        run.text = run.text.chars().take(characters).collect();
                        characters -= run.text.chars().count();
                    }
                    paragraph.runs.retain(|run| !run.text.is_empty());
                }
                rich.paragraphs
                    .retain(|paragraph| !paragraph.runs.is_empty());
            }
            if let Some(image) = &element.image_data {
                if image.len() <= image_budget {
                    image_budget -= image.len();
                } else {
                    element.image_data = None;
                }
            }
            element
        })
        .collect();
    BoardPreview {
        id: board.id.clone(),
        revision: board.revision,
        background: board.background,
        color_scheme: board.color_scheme,
        bounds: content_bounds(&visible),
        elements,
    }
}

/// A read-only projection: never persists thumbnails or changes the source Paper.
#[tauri::command]
pub fn get_board_preview(
    vault: tauri::State<'_, VaultStore>,
    id: String,
) -> Result<BoardPreview, String> {
    boards::get_board(vault, id).map(|board| make_preview(&board))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn element(id: usize) -> BoardElement {
        serde_json::from_value(
            json!({"id":id.to_string(),"kind":"rectangle","x":id as f64,"y":0,
            "width":100,"height":50,"text":"","color":"neutral","resolved":false,
            "points":[],"startId":null,"endId":null,"taskId":null,"imageData":null}),
        )
        .unwrap()
    }
    fn board(elements: Vec<BoardElement>) -> Board {
        serde_json::from_value(json!({"id":"preview","title":"Preview","revision":1,
            "formatVersion":1,"elements":elements,"createdAt":"now","updatedAt":"now"}))
        .unwrap()
    }

    #[test]
    fn layers_control_preview_visibility_order_and_opacity_without_mutation() {
        let mut a = element(0);
        a.layer_id = Some("top".into());
        a.opacity = 0.8;
        let mut b = element(1);
        b.layer_id = Some("hidden".into());
        let c = element(2);
        let mut original = board(vec![a, b, c]);
        original.layers = serde_json::from_value(json!([
            {"id":"base","name":"Base","visible":true,"locked":false,"opacity":1.0},
            {"id":"hidden","name":"Hidden","visible":false,"locked":false,"opacity":1.0},
            {"id":"top","name":"Top","visible":true,"locked":false,"opacity":0.5}
        ]))
        .unwrap();
        let before = original.clone();
        let result = make_preview(&original);
        assert_eq!(
            result
                .elements
                .iter()
                .map(|e| e.id.as_str())
                .collect::<Vec<_>>(),
            vec!["2", "0"]
        );
        assert_eq!(result.elements[1].opacity, 0.4);
        assert_eq!(original, before);
    }

    #[test]
    fn bounded_preview_preserves_original_and_samples_first_last() {
        let original = board((0..1000).map(element).collect());
        let before = original.clone();
        let result = make_preview(&original);
        assert_eq!(result.elements.len(), MAX_ELEMENTS);
        assert_eq!(result.elements[0].id, "0");
        assert_eq!(result.elements.last().unwrap().id, "999");
        assert_eq!(result.bounds.width, 1100.0);
        assert_eq!(original, before);
    }

    #[test]
    fn stroke_sampling_keeps_endpoints_extrema_and_pressure() {
        let mut points: Vec<_> = (0..1000)
            .map(|i| BoardPoint {
                x: i as f64,
                y: 0.0,
                pressure: Some(i as f64 / 1000.0),
            })
            .collect();
        points[333].y = 1000.0;
        points[777].y = -1000.0;
        let result = preview_points(&points);
        assert!(result.len() <= MAX_POINTS);
        for i in [0, 333, 777, 999] {
            assert!(result.contains(&points[i]));
        }
    }

    #[test]
    fn rich_unicode_text_and_image_budget_are_bounded() {
        let mut item = element(0);
        item.text = "🎨é".repeat(300);
        item.rich_text = Some(serde_json::from_value(json!({"paragraphs": (0..8).map(|_| json!({"align":"left","list":"none","runs":(0..10).map(|_| json!({"text":"🎨".repeat(100),"bold":false,"italic":false,"underline":false,"font":"sans","fontSize":22,"color":"#000000","highlight":"none"})).collect::<Vec<_>>()})).collect::<Vec<_>>()})).unwrap());
        let mut image = element(1);
        image.kind = "image".into();
        image.image_data = Some("a".repeat(MAX_IMAGE_BYTES));
        let mut second_image = image.clone();
        second_image.id = "2".into();
        let source = board(vec![item, image, second_image]);
        let original = source.clone();
        let result = make_preview(&source);
        assert_eq!(source, original);
        assert_eq!(result.elements[0].text.chars().count(), MAX_TEXT);
        let rich = result.elements[0].rich_text.as_ref().unwrap();
        assert!(rich.paragraphs.len() <= 4);
        assert!(rich.paragraphs.iter().map(|p| p.runs.len()).sum::<usize>() <= 8);
        assert_eq!(
            rich.paragraphs
                .iter()
                .flat_map(|p| &p.runs)
                .map(|r| r.text.chars().count())
                .sum::<usize>(),
            MAX_TEXT
        );
        assert!(result.elements[1].image_data.is_some());
        assert!(result.elements[2].image_data.is_none());
    }

    #[test]
    fn preview_annotations_are_static_without_changing_authored_animation() {
        let annotation = json!({"type":"highlight","color":"#ffff00","strokeWidth":2,
            "padding":5,"iterations":2,"brackets":["right"],"animate":true,
            "animationDuration":800,"animationDelay":0,"multiline":true,"rtl":false});
        let mut item = element(0);
        item.text = "Idea".into();
        item.text_annotation = Some(serde_json::from_value(annotation.clone()).unwrap());
        item.rich_text = Some(
            serde_json::from_value(json!({"paragraphs":[{
            "align":"left","list":"none","runs":[{"text":"Idea","bold":false,
            "italic":false,"underline":false,"font":"sans","fontSize":22,
            "color":"#000000","highlight":"none","annotation":annotation}]}]}))
            .unwrap(),
        );
        let original = board(vec![item]);
        let before = original.clone();
        let result = make_preview(&original);
        assert_eq!(original, before);
        assert!(
            original.elements[0]
                .text_annotation
                .as_ref()
                .unwrap()
                .animate
        );
        assert!(
            original.elements[0].rich_text.as_ref().unwrap().paragraphs[0].runs[0]
                .annotation
                .as_ref()
                .unwrap()
                .animate
        );
        assert!(!result.elements[0].text_annotation.as_ref().unwrap().animate);
        assert!(
            !result.elements[0].rich_text.as_ref().unwrap().paragraphs[0].runs[0]
                .annotation
                .as_ref()
                .unwrap()
                .animate
        );
    }

    #[test]
    fn oversized_image_is_placeholder_without_consuming_budget_for_later_images() {
        let mut large = element(0);
        large.kind = "image".into();
        large.image_data = Some("a".repeat(MAX_IMAGE_BYTES + 1));
        let mut small = element(1);
        small.kind = "image".into();
        small.image_data = Some("small".into());
        let result = make_preview(&board(vec![large, small]));
        assert!(result.elements[0].image_data.is_none());
        assert_eq!(result.elements[1].image_data.as_deref(), Some("small"));
    }

    #[test]
    fn bounds_include_rotation_negative_dimensions_and_empty_canvas() {
        let mut rotated = element(0);
        rotated.angle = std::f64::consts::FRAC_PI_2;
        let bounds = content_bounds(&[rotated]);
        assert!((bounds.x - 24.5).abs() < 0.0001);
        assert!((bounds.y + 25.5).abs() < 0.0001);
        assert!((bounds.width - 51.0).abs() < 0.0001);
        let mut line = element(1);
        line.x = 100.0;
        line.y = 100.0;
        line.width = -80.0;
        line.height = -30.0;
        line.kind = "line".into();
        let bounds = content_bounds(&[line]);
        assert_eq!(bounds.x, 19.5);
        assert_eq!(bounds.y, 69.5);
        assert_eq!(bounds.width, 81.0);
        assert_eq!(bounds.height, 31.0);
        let empty = content_bounds(&[]);
        assert_eq!(empty.width, 1.0);
        assert!(empty.x.is_finite());
    }
}
