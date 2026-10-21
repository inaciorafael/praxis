use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PostitMode {
    Micro,
    Compact,
    Expanded,
}
#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
pub struct FrameSize {
    pub width: f64,
    pub height: f64,
}
impl FrameSize {
    pub fn valid(self) -> bool {
        self.width.is_finite()
            && self.height.is_finite()
            && (280.0..=600.0).contains(&self.width)
            && (220.0..=700.0).contains(&self.height)
    }
}
#[derive(Clone, Debug)]
pub struct DesktopFrame {
    pub anchor: (f64, f64),
    pub drawn: (f64, f64),
    pub size: FrameSize,
    pub transient: Option<PostitMode>,
    pub editing: bool,
    pub resizing: bool,
    pub active_note: Option<String>,
}
pub fn size(mode: PostitMode, expanded: Option<FrameSize>, group: bool) -> FrameSize {
    match mode {
        PostitMode::Micro => FrameSize {
            width: 180.0,
            height: 40.0,
        },
        PostitMode::Compact => FrameSize {
            width: 248.0,
            height: if group { 240.0 } else { 132.0 },
        },
        PostitMode::Expanded => expanded.filter(|s| s.valid()).unwrap_or(FrameSize {
            width: 340.0,
            height: 380.0,
        }),
    }
}
pub fn anchored(anchor: (f64, f64), size: FrameSize, area: (f64, f64, f64, f64)) -> (f64, f64) {
    (
        anchor
            .0
            .clamp(area.0, (area.0 + area.2 - size.width).max(area.0)),
        anchor
            .1
            .clamp(area.1, (area.1 + area.3 - size.height).max(area.1)),
    )
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn expansion_keeps_anchor_and_fits_negative_monitor() {
        let anchor = (-80.0, 960.0);
        let expanded = anchored(
            anchor,
            size(PostitMode::Expanded, None, false),
            (-1920.0, 0.0, 1920.0, 1080.0),
        );
        assert_eq!(expanded, (-340.0, 700.0));
        assert_eq!(anchor, (-80.0, 960.0));
        assert_eq!(
            anchored(
                anchor,
                size(PostitMode::Micro, None, false),
                (-1920.0, 0.0, 1920.0, 1080.0)
            ),
            (-180.0, 960.0)
        );
    }
    #[test]
    fn dimensions_are_finite_and_bounded() {
        assert!(!FrameSize {
            width: f64::NAN,
            height: 300.0
        }
        .valid());
        assert!(!FrameSize {
            width: 2000.0,
            height: 300.0
        }
        .valid());
        assert!(FrameSize {
            width: 420.0,
            height: 600.0
        }
        .valid());
    }
    #[test]
    fn every_corner_keeps_the_whole_expanded_note_inside_work_area() {
        let area = (0.0, 40.0, 1920.0, 1000.0); // taskbar excluded
        let size = FrameSize {
            width: 420.0,
            height: 600.0,
        };
        for anchor in [
            (-200.0, -300.0),
            (1910.0, 20.0),
            (-90.0, 1020.0),
            (1910.0, 1020.0),
        ] {
            let point = anchored(anchor, size, area);
            assert!(point.0 >= area.0 && point.1 >= area.1);
            assert!(point.0 + size.width <= area.0 + area.2);
            assert!(point.1 + size.height <= area.1 + area.3);
        }
    }
    #[test]
    fn mixed_dpi_uses_physical_window_bounds_without_scaling_monitor_origin() {
        // A physical left monitor at 150% next to a primary monitor at 100%.
        let area = (-2560.0, 0.0, 2560.0, 1400.0);
        let scale = 1.5;
        let logical_anchor = (-30.0, 900.0);
        let outer = FrameSize {
            width: 630.0,
            height: 900.0,
        };
        let position = anchored(
            (logical_anchor.0 * scale, logical_anchor.1 * scale),
            outer,
            area,
        );
        assert_eq!(position, (-630.0, 500.0));
        let logical = (position.0 / scale, position.1 / scale);
        assert_eq!(logical.0 * scale, position.0);
        assert_eq!(logical.1 * scale, position.1);
    }
    #[test]
    fn dragging_half_outside_is_clamped_in_all_directions() {
        let size = FrameSize {
            width: 248.0,
            height: 132.0,
        };
        let area = (1920.0, -1080.0, 1920.0, 1040.0);
        assert_eq!(anchored((1850.0, -1200.0), size, area), (1920.0, -1080.0));
        assert_eq!(anchored((3800.0, -50.0), size, area), (3592.0, -172.0));
        // Repeated movement past the boundary stays at that boundary.
        assert_eq!(anchored((3900.0, -10.0), size, area), (3592.0, -172.0));
    }
}
