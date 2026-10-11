import { colorToFrequency } from './color-frequency';

export interface FlagColor {
  hex: string;
  pixelCount: number;
  frequency: number;
}

const MINIMUM_LINE_COVERAGE = 0.04;

export function extractLineColors(linePixels: Uint8ClampedArray): FlagColor[] {
  const colorCounts = new Map<string, number>();
  const lineLength = linePixels.length / 4;
  const minimumPixelCount = Math.max(2, Math.ceil(lineLength * MINIMUM_LINE_COVERAGE));

  for (let pixel = 0; pixel < linePixels.length; pixel += 4) {
    if (linePixels[pixel + 3] === 0) {
      continue;
    }

    const hex = `#${[linePixels[pixel], linePixels[pixel + 1], linePixels[pixel + 2]]
      .map((channel) => channel.toString(16).padStart(2, '0'))
      .join('')}`;
    colorCounts.set(hex, (colorCounts.get(hex) ?? 0) + 1);
  }

  return Array.from(colorCounts, ([hex, pixelCount]) => ({
    hex,
    pixelCount,
    frequency: colorToFrequency(hex),
  }))
    .filter((color) => color.pixelCount >= minimumPixelCount)
    .sort((a, b) => b.pixelCount - a.pixelCount);
}
