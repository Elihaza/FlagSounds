import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Component, inject, PLATFORM_ID, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FlagCountry } from './flag-country';
import { FlagList } from './flag-list/flag-list';
import { FlagPlayer } from './flag-player/flag-player';

@Component({
  imports: [FlagList, FlagPlayer, RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly isDarkMode = signal(true);
  protected readonly selectedCountry = signal<FlagCountry>({
    code: 'FR',
    name: 'France',
  });

  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor() {
    if (!this.isBrowser) {
      return;
    }

    const savedTheme = window.localStorage.getItem('flag-notes-theme');
    this.setDarkMode(savedTheme !== 'light');
  }

  protected selectCountry(country: FlagCountry): void {
    this.selectedCountry.set(country);
  }

  protected toggleTheme(): void {
    this.setDarkMode(!this.isDarkMode());
    window.localStorage.setItem('flag-notes-theme', this.isDarkMode() ? 'dark' : 'light');
  }

  private setDarkMode(isDark: boolean): void {
    this.isDarkMode.set(isDark);
    this.document.documentElement.dataset['theme'] = isDark ? 'dark' : 'light';
  }
}
