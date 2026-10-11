import { DOCUMENT } from '@angular/common';
import { Component, inject, input, OnChanges, OnDestroy, signal } from '@angular/core';
import { FlagCountry } from '../flag-country';
import { extractLineColors, FlagColor } from './color-sampling';

const PLAYBACK_DURATION_MS = 3000;

interface ActiveTone {
  oscillator: OscillatorNode;
  gain: GainNode;
}

type ScanDirection = 'horizontal' | 'vertical';

@Component({
  selector: 'app-flag-player',
  styleUrl: './flag-player.css',
  templateUrl: './flag-player.html',
})
export class FlagPlayer implements OnChanges, OnDestroy {
  readonly country = input.required<FlagCountry>();
  protected readonly isPlaying = signal(false);
  protected readonly isManualPreview = signal(false);
  protected readonly scanDirection = signal<ScanDirection>('horizontal');
  protected readonly progress = signal(0);
  protected readonly sampledColors = signal<FlagColor[]>([]);
  protected readonly colorReadError = signal<string | null>(null);
  protected readonly audioError = signal<string | null>(null);

  private readonly document = inject(DOCUMENT);
  private canvasContext: CanvasRenderingContext2D | null = null;
  private audioContext: AudioContext | undefined;
  private readonly activeTones = new Map<string, ActiveTone>();
  private elapsedMs = 0;
  private startedAt = 0;
  private animationFrame: number | undefined;
  private activePointerId: number | undefined;

  ngOnChanges(): void {
    this.goToBeginning();
    this.canvasContext = null;
    this.sampledColors.set([]);
    this.colorReadError.set(null);
    this.audioError.set(null);
  }

  loadFlag(event: Event): void {
    const image = event.target;
    if (!(image instanceof HTMLImageElement)) {
      this.colorReadError.set('Could not read the loaded flag image.');
      return;
    }

    const canvas = this.document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (!context || canvas.width === 0 || canvas.height === 0) {
      this.colorReadError.set('Could not prepare the flag for color reading.');
      return;
    }

    try {
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      this.canvasContext = context;
      this.colorReadError.set(null);
      this.updateSampledColor();
    } catch (error) {
      this.canvasContext = null;
      this.colorReadError.set(
        error instanceof Error ? `Could not read flag colors: ${error.message}` : 'Could not read flag colors.',
      );
    }
  }

  handleFlagError(): void {
    this.canvasContext = null;
    this.sampledColors.set([]);
    this.colorReadError.set(`Could not load the flag of ${this.country().name}.`);
  }

  async play(): Promise<void> {
    if (this.isPlaying()) {
      return;
    }

    this.isManualPreview.set(false);
    if (this.elapsedMs >= PLAYBACK_DURATION_MS) {
      this.elapsedMs = 0;
      this.progress.set(0);
      this.updateSampledColor();
    }

    this.startedAt = performance.now();
    this.isPlaying.set(true);
    this.audioError.set(null);
    try {
      await this.startAudio();
    } catch (error) {
      this.audioError.set(
        error instanceof Error ? `Audio playback failed: ${error.message}` : 'Audio playback failed.',
      );
    }

    if (!this.isPlaying()) {
      this.stopTones();
      return;
    }

    this.updateTones();
    this.animationFrame = requestAnimationFrame(this.updateProgress);
  }

  pause(): void {
    if (!this.isPlaying() && !this.isManualPreview()) {
      return;
    }

    if (this.isPlaying()) {
      this.elapsedMs = Math.min(
        PLAYBACK_DURATION_MS,
        this.elapsedMs + performance.now() - this.startedAt,
      );
      this.progress.set(this.elapsedMs / PLAYBACK_DURATION_MS);
    }

    this.cancelAnimationFrame();
    this.isPlaying.set(false);
    this.isManualPreview.set(false);
    this.stopTones();
    this.updateSampledColor();
  }

  goToBeginning(): void {
    this.cancelAnimationFrame();
    this.elapsedMs = 0;
    this.progress.set(0);
    this.isPlaying.set(false);
    this.isManualPreview.set(false);
    this.stopTones();
    this.updateSampledColor();
  }

  seekFromPointer(event: PointerEvent): void {
    const track = event.currentTarget;
    if (!(track instanceof HTMLElement)) {
      return;
    }

    if (event.type === 'pointerdown') {
      if (event.button !== 0) {
        return;
      }

      this.activePointerId = event.pointerId;
      track.setPointerCapture(event.pointerId);
    } else if (this.activePointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    const bounds = track.getBoundingClientRect();
    if (bounds.width <= 0) {
      return;
    }

    const progress = this.scanDirection() === 'horizontal'
      ? (event.clientX - bounds.left) / bounds.width
      : (event.clientY - bounds.top) / bounds.height;
    this.seekToProgress(progress);
  }

  finishPointerSeek(event: PointerEvent): void {
    if (this.activePointerId !== event.pointerId) {
      return;
    }

    const track = event.currentTarget;
    if (track instanceof HTMLElement && track.hasPointerCapture(event.pointerId)) {
      track.releasePointerCapture(event.pointerId);
    }
    this.activePointerId = undefined;

    if (this.isManualPreview()) {
      this.isManualPreview.set(false);
      this.stopTones();
    }
  }

  seekWithKeyboard(event: KeyboardEvent): void {
    const step = event.shiftKey ? 0.1 : 0.01;
    let nextProgress: number;
    const increasingKeys = this.scanDirection() === 'horizontal'
      ? ['ArrowRight']
      : ['ArrowDown'];
    const decreasingKeys = this.scanDirection() === 'horizontal'
      ? ['ArrowLeft']
      : ['ArrowUp'];

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        if (!decreasingKeys.includes(event.key)) {
          return;
        }
        nextProgress = this.progress() - step;
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        if (!increasingKeys.includes(event.key)) {
          return;
        }
        nextProgress = this.progress() + step;
        break;
      case 'Home':
        nextProgress = 0;
        break;
      case 'End':
        nextProgress = 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    this.seekToProgress(nextProgress);
  }

  setScanDirection(direction: ScanDirection): void {
    this.scanDirection.set(direction);
    this.updateSampledColor();
  }

  ngOnDestroy(): void {
    this.cancelAnimationFrame();
    this.stopTones();
    void this.audioContext?.close();
  }

  private readonly updateProgress = (timestamp: number): void => {
    this.elapsedMs = Math.min(
      PLAYBACK_DURATION_MS,
      this.elapsedMs + timestamp - this.startedAt,
    );
    this.startedAt = timestamp;
    this.progress.set(this.elapsedMs / PLAYBACK_DURATION_MS);
    this.updateSampledColor();

    if (this.elapsedMs >= PLAYBACK_DURATION_MS) {
      this.isPlaying.set(false);
      this.isManualPreview.set(false);
      this.animationFrame = undefined;
      this.stopTones();
      return;
    }

    this.animationFrame = requestAnimationFrame(this.updateProgress);
  };

  private seekToProgress(progress: number): void {
    const normalizedProgress = Math.max(0, Math.min(1, progress));
    this.cancelAnimationFrame();
    this.isPlaying.set(false);
    this.isManualPreview.set(true);
    this.progress.set(normalizedProgress);
    this.elapsedMs = normalizedProgress * PLAYBACK_DURATION_MS;
    this.updateSampledColor();
    void this.startManualPreview();
  }

  private async startManualPreview(): Promise<void> {
    this.audioError.set(null);
    try {
      await this.startAudio();
      if (this.isManualPreview() && !this.isPlaying()) {
        this.updateTones();
      }
    } catch (error) {
      this.audioError.set(
        error instanceof Error ? `Audio playback failed: ${error.message}` : 'Audio playback failed.',
      );
    }
  }

  private updateSampledColor(): void {
    if (!this.canvasContext) {
      return;
    }

    const width = this.canvasContext.canvas.width;
    const height = this.canvasContext.canvas.height;
    const position = this.scanDirection() === 'horizontal'
      ? Math.min(width - 1, Math.floor(this.progress() * width))
      : Math.min(height - 1, Math.floor(this.progress() * height));

    try {
      const linePixels = this.scanDirection() === 'horizontal'
        ? this.canvasContext.getImageData(position, 0, 1, height).data
        : this.canvasContext.getImageData(0, position, width, 1).data;
      this.sampledColors.set(extractLineColors(linePixels));
      this.updateTones();
      this.colorReadError.set(null);
    } catch (error) {
      this.canvasContext = null;
      this.sampledColors.set([]);
      this.colorReadError.set(
        error instanceof Error ? `Could not read flag colors: ${error.message}` : 'Could not read flag colors.',
      );
    }
  }

  private async startAudio(): Promise<void> {
    const AudioContextConstructor = this.document.defaultView?.AudioContext;
    if (!AudioContextConstructor) {
      throw new Error('This browser does not support Web Audio.');
    }

    this.audioContext ??= new AudioContextConstructor();
    await this.audioContext.resume();
  }

  private updateTones(): void {
    if (!this.audioContext || (!this.isPlaying() && !this.isManualPreview())) {
      return;
    }

    try {
      const now = this.audioContext.currentTime;
      const colors = this.sampledColors();
      const wantedColors = new Set(colors.map(({ hex }) => hex));

      for (const [hex, tone] of this.activeTones) {
        if (!wantedColors.has(hex)) {
          tone.gain.gain.setTargetAtTime(0, now, 0.015);
          tone.oscillator.stop(now + 0.08);
          this.activeTones.delete(hex);
        }
      }

      const volume = colors.length ? 0.12 / Math.sqrt(colors.length) : 0;
      for (const color of colors) {
        let tone = this.activeTones.get(color.hex);
        if (!tone) {
          const oscillator = this.audioContext.createOscillator();
          const gain = this.audioContext.createGain();
          oscillator.type = 'sine';
          oscillator.frequency.value = color.frequency;
          gain.gain.value = 0;
          oscillator.connect(gain);
          gain.connect(this.audioContext.destination);
          oscillator.start();
          tone = { oscillator, gain };
          this.activeTones.set(color.hex, tone);
        }

        tone.oscillator.frequency.setTargetAtTime(color.frequency, now, 0.02);
        tone.gain.gain.setTargetAtTime(volume, now, 0.02);
      }
    } catch (error) {
      this.audioError.set(
        error instanceof Error ? `Audio playback failed: ${error.message}` : 'Audio playback failed.',
      );
      this.stopTones();
    }
  }

  private stopTones(): void {
    if (!this.audioContext) {
      return;
    }

    const now = this.audioContext.currentTime;
    for (const tone of this.activeTones.values()) {
      tone.gain.gain.setTargetAtTime(0, now, 0.015);
      tone.oscillator.stop(now + 0.08);
    }
    this.activeTones.clear();
  }

  private cancelAnimationFrame(): void {
    if (this.animationFrame !== undefined) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = undefined;
    }
  }
}
