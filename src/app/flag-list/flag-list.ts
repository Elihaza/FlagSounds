import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { countries } from 'country-flag-icons';
import { FlagCountry } from '../flag-country';

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
const subdivisionNames: Record<string, string> = {
  'BQ-BO': 'Bonaire',
  'BQ-SA': 'Saba',
  'BQ-SE': 'Sint Eustatius',
  'ES-CT': 'Catalonia',
  'GB-ENG': 'England',
  'GB-NIR': 'Northern Ireland',
  'GB-SCT': 'Scotland',
  'GB-WLS': 'Wales',
};

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-flag-list',
  styleUrl: './flag-list.css',
  templateUrl: './flag-list.html',
})
export class FlagList {
  readonly selectedCode = input.required<string>();
  readonly countrySelected = output<FlagCountry>();

  protected readonly searchTerm = signal('');
  protected readonly flagCountries: FlagCountry[] = countries
    .map((code) => ({
      code,
      name: subdivisionNames[code] ?? regionNames.of(code) ?? code,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  protected readonly filteredCountries = computed(() => {
    const query = this.searchTerm().trim().toLocaleLowerCase();
    if (!query) {
      return this.flagCountries;
    }

    return this.flagCountries.filter(({ code, name }) =>
      name.toLocaleLowerCase().includes(query) || code.toLocaleLowerCase().includes(query),
    );
  });

  protected updateSearch(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.searchTerm.set(target.value);
    }
  }

  protected selectCountry(country: FlagCountry): void {
    this.countrySelected.emit(country);
  }
}
