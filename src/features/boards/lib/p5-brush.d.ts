declare module 'p5.brush/standalone' {
  export function load(canvas: HTMLCanvasElement): void
  export function clear(): void
  export function render(): void
  export function seed(value: number): void
  export function noiseSeed(value: number): void
  export function push(): void
  export function pop(): void
  export function translate(x: number, y: number): void
  export function set(name: string, color: string, weight: number): void
  export function noFill(): void
  export function noHatch(): void
  export function noMass(): void
  export function noWash(): void
  export function noField(): void
  export function noStroke(): void
  export function fill(color: string, opacity: number): void
  export function fillTexture(strength: number, border?: number): void
  export function fillBleed(strength: number, direction?: string, curve?: number): void
  export function spline(points: number[][], curvature?: number): unknown
  export function polygon(points: number[][]): unknown
  export function circle(
    x: number,
    y: number,
    radius: number,
    irregularity?: number
  ): unknown
}
