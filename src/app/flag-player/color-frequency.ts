const MIN_FREQUENCY_HZ = 200;
const MAX_FREQUENCY_HZ = 400;
const MAX_SPECTRAL_HUE_DEGREES = 270;
const RED_HUE_WRAP_START = 330;
const ACHROMATIC_FREQUENCY_HZ = 300;

export function colorToFrequency(hex: string): number {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) {
    throw new Error(`Invalid RGB hex color: ${hex}`);
  }

  const red = Number.parseInt(match[1].slice(0, 2), 16) / 255;
  const green = Number.parseInt(match[1].slice(2, 4), 16) / 255;
  const blue = Number.parseInt(match[1].slice(4, 6), 16) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const difference = maximum - minimum;

  if (difference === 0) {
    return ACHROMATIC_FREQUENCY_HZ;
  }

  let hue: number;
  if (maximum === red) {
    hue = 60 * (((green - blue) / difference) % 6);
  } else if (maximum === green) {
    hue = 60 * ((blue - red) / difference + 2);
  } else {
    hue = 60 * ((red - green) / difference + 4);
  }

  if (hue < 0) {
    hue += 360;
  }

  const spectralHue = hue >= RED_HUE_WRAP_START ? 0 : Math.min(hue, MAX_SPECTRAL_HUE_DEGREES);
  return Math.round(
    MIN_FREQUENCY_HZ +
      (spectralHue / MAX_SPECTRAL_HUE_DEGREES) * (MAX_FREQUENCY_HZ - MIN_FREQUENCY_HZ),
  );
}
