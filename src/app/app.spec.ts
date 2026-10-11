import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { extractLineColors } from './flag-player/color-sampling';
import { colorToFrequency } from './flag-player/color-frequency';

describe('App', () => {
  beforeEach(async () => {
    localStorage.removeItem('flag-notes-theme');
    await TestBed.configureTestingModule({
      imports: [App],
    })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should link to the project repository from the footer', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const link = compiled.querySelector<HTMLAnchorElement>('.github-link');
    expect(link?.getAttribute('href')).toBe('https://github.com/Elihaza/FlagSounds');
    expect(link?.getAttribute('aria-label')).toBe('View FlagSounds on GitHub');
  });

  it('should render the flag player and scan direction', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Every flag has');
    expect(compiled.querySelector<HTMLImageElement>('.flag')?.alt).toBe('Flag of France');
    expect(compiled.querySelector<HTMLButtonElement>('.direction-toggle button')?.textContent).toContain('Horizontal');
    expect(compiled.querySelector<HTMLButtonElement>('.direction-toggle button')?.getAttribute('aria-pressed')).toBe('true');
    expect(compiled.querySelectorAll('.country-card').length).toBeGreaterThan(200);
  });

  it('should update the player when a flag card is selected', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const italyCard = Array.from(compiled.querySelectorAll<HTMLButtonElement>('.country-card'))
      .find((card) => card.textContent?.includes('Italy'));
    expect(italyCard).toBeTruthy();

    italyCard?.click();
    fixture.detectChanges();

    expect(compiled.querySelector('#player-title')?.textContent).toBe('Italy');
    expect(compiled.querySelector<HTMLImageElement>('.flag')?.getAttribute('src')).toBe('/3x2/IT.svg');
    expect(italyCard?.getAttribute('aria-pressed')).toBe('true');
  });

  it('should filter the flag cards by country name', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const search = compiled.querySelector<HTMLInputElement>('input[type="search"]');
    expect(search).toBeTruthy();
    if (!search) {
      throw new Error('Flag search input was not rendered');
    }

    search.value = 'Japan';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(compiled.querySelectorAll('.country-card').length).toBe(1);
    expect(compiled.querySelector('.country-name')?.textContent).toBe('Japan');
  });

  it('should toggle and persist the color theme', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const toggle = compiled.querySelector<HTMLButtonElement>('.theme-toggle');
    expect(toggle).toBeTruthy();
    if (!toggle) {
      throw new Error('Theme toggle was not rendered');
    }

    toggle.click();
    fixture.detectChanges();

    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(localStorage.getItem('flag-notes-theme')).toBe('dark');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });

  it('should provide play, pause, and return-to-beginning controls', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const progress = compiled.querySelector<HTMLElement>('[role="slider"]');
    const play = compiled.querySelector<HTMLButtonElement>('[aria-label="Play"]');
    const pause = compiled.querySelector<HTMLButtonElement>('[aria-label="Pause"]');
    const reset = compiled.querySelector<HTMLButtonElement>('[aria-label="Go to beginning"]');

    expect(progress?.getAttribute('aria-valuenow')).toBe('0');
    expect(play?.disabled).toBe(false);
    expect(pause?.disabled).toBe(true);
    expect(reset).toBeTruthy();

    play?.click();
    fixture.detectChanges();
    expect(play?.disabled).toBe(true);
    expect(pause?.disabled).toBe(false);

    pause?.click();
    fixture.detectChanges();
    expect(play?.disabled).toBe(false);
    expect(pause?.disabled).toBe(true);

    reset?.click();
    fixture.detectChanges();
    expect(progress?.getAttribute('aria-valuenow')).toBe('0');
  });

  it('should allow keyboard scrubbing of the flag playback position', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const slider = compiled.querySelector<HTMLElement>('[role="slider"]');
    expect(slider).toBeTruthy();
    if (!slider) {
      throw new Error('Playback slider was not rendered');
    }

    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();
    expect(slider.getAttribute('aria-valuenow')).toBe('1');
    expect(compiled.querySelector<HTMLButtonElement>('[aria-label="Play"]')?.disabled).toBe(false);
    expect(compiled.querySelector<HTMLButtonElement>('[aria-label="Pause"]')?.disabled).toBe(false);

    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    fixture.detectChanges();
    expect(slider.getAttribute('aria-valuenow')).toBe('100');
  });

  it('should switch the playhead layout and keyboard axis to vertical', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const verticalButton = Array.from(compiled.querySelectorAll<HTMLButtonElement>('.direction-toggle button'))
      .find((button) => button.textContent?.trim() === 'Vertical');
    const slider = compiled.querySelector<HTMLElement>('[role="slider"]');
    if (!verticalButton || !slider) {
      throw new Error('Scan direction controls were not rendered');
    }

    verticalButton.click();
    fixture.detectChanges();
    expect(verticalButton.getAttribute('aria-pressed')).toBe('true');
    expect(compiled.querySelector('.flag-layout')?.classList.contains('is-vertical')).toBe(true);
    expect(slider.getAttribute('aria-label')).toContain('vertical');

    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    expect(slider.getAttribute('aria-valuenow')).toBe('1');
  });

  it('should let manual scrubbing override an active automatic scan', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const slider = compiled.querySelector<HTMLElement>('[role="slider"]');
    const play = compiled.querySelector<HTMLButtonElement>('[aria-label="Play"]');
    const pause = compiled.querySelector<HTMLButtonElement>('[aria-label="Pause"]');
    if (!slider || !play || !pause) {
      throw new Error('Playback controls were not rendered');
    }

    play.click();
    fixture.detectChanges();
    expect(play.disabled).toBe(true);

    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    fixture.detectChanges();

    expect(slider.getAttribute('aria-valuenow')).toBe('100');
    expect(play.disabled).toBe(false);
    expect(pause.disabled).toBe(false);

    pause.click();
    fixture.detectChanges();
    expect(pause.disabled).toBe(true);
  });

  it('should ignore antialiased shades at Bahrain flag edges', () => {
    const pixelData: number[] = [];
    const addPixels = (color: [number, number, number], count: number): void => {
      for (let i = 0; i < count; i += 1) {
        pixelData.push(...color, 255);
      }
    };

    addPixels([255, 255, 255], 131);
    addPixels([216, 0, 39], 9);
    addPixels([245, 191, 201], 5);
    addPixels([240, 159, 174], 4);
    addPixels([221, 32, 66], 1);

    const colors = extractLineColors(new Uint8ClampedArray(pixelData));

    expect(colors.map(({ hex }) => hex)).toEqual(['#ffffff', '#d80027']);
    expect(colors.map(({ frequency }) => frequency)).toEqual([600, 400]);
  });

  it('should extract all colors across a vertical scan row', () => {
    const pixelData: number[] = [];
    const addPixels = (color: [number, number, number], count: number): void => {
      for (let i = 0; i < count; i += 1) {
        pixelData.push(...color, 255);
      }
    };

    addPixels([0, 85, 164], 50);
    addPixels([255, 255, 255], 50);
    addPixels([239, 65, 53], 50);

    const colors = extractLineColors(new Uint8ClampedArray(pixelData));

    expect(colors.map(({ hex }) => hex)).toEqual(['#0055a4', '#ffffff', '#ef4135']);
  });

  it('should map flag hues into the 400–800 Hz octave', () => {
    expect(colorToFrequency('#d80027')).toBe(400);
    expect(colorToFrequency('#00ff00')).toBe(578);
    expect(colorToFrequency('#0000ff')).toBe(756);
    expect(colorToFrequency('#ff00ff')).toBe(800);
    expect(colorToFrequency('#ffffff')).toBe(600);
    expect(colorToFrequency('#000000')).toBe(600);
  });

  it('should reject malformed RGB colors', () => {
    expect(() => colorToFrequency('#fff')).toThrow('Invalid RGB hex color');
  });
});
