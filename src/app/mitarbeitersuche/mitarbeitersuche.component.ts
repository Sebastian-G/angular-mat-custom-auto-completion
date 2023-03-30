import {AfterViewInit, Component, forwardRef, Input, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ControlValueAccessor, FormControl, NG_VALUE_ACCESSOR, ReactiveFormsModule} from "@angular/forms";
import {MatAutocompleteModule, MatAutocompleteSelectedEvent} from "@angular/material/autocomplete";
import {
  BehaviorSubject,
  delay,
  distinct, distinctUntilChanged,
  finalize,
  map, merge,
  Observable,
  of,
  ReplaySubject,
  startWith,
  withLatestFrom
} from "rxjs";
import {MatInputModule} from "@angular/material/input";

export enum Zustaendigkeit {
  BERATER = 'BERATER'
}

export interface Mitarbeiter {
  kennung: string;
  vorname: string;
  nachname: string;
  zustaendigkeit: Zustaendigkeit
}


const MOCK_MITARBEITER: Mitarbeiter[] = [
  {
    kennung: '12345',
    nachname: 'Mustermann',
    vorname: 'Max',
    zustaendigkeit: Zustaendigkeit.BERATER
  },
  {
    kennung: '11111',
    nachname: 'Hans',
    vorname: 'Herrmann',
    zustaendigkeit: Zustaendigkeit.BERATER
  },
  {
    kennung: '999999',
    nachname: 'Was',
    vorname: 'Auch von Immer',
    zustaendigkeit: Zustaendigkeit.BERATER
  }
];

export class MitarbeiterService {
  public getMitarbeiter(): Observable<Mitarbeiter[]> {
    return of([...MOCK_MITARBEITER]).pipe(delay(10000))
  }
}

@Component({
  selector: 'app-mitarbeitersuche',
  standalone: true,
  imports: [CommonModule, MatInputModule, MatAutocompleteModule, ReactiveFormsModule],
  templateUrl: './mitarbeitersuche.component.html',
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => MitarbeitersucheComponent),
    multi: true
  },
    MitarbeiterService
  ]
})
export class MitarbeitersucheComponent implements ControlValueAccessor, OnInit {

  @Input() label: string = '';

  private readonly loadingSubject = new ReplaySubject<boolean>(1);
  readonly isLoading$ = this.loadingSubject.asObservable();
  private readonly optionsSubject: BehaviorSubject<Mitarbeiter[]> = new BehaviorSubject<Mitarbeiter[]>([]);

  private readonly formControl = new FormControl<Mitarbeiter | null>(null);
  readonly searchControl = new FormControl<string>('');

  readonly filteredOptions$: Observable<Mitarbeiter[]> = merge(this.optionsSubject.asObservable(), this.searchControl.valueChanges).pipe(
    map(() => this.searchControl.value),
    map((value) => typeof value === 'string' ? value : ''),
    distinctUntilChanged(),
    startWith(''),
    withLatestFrom(this.optionsSubject),
    map(([searchTerm, options]: [string | null, Mitarbeiter[]]): Mitarbeiter[] =>
      filterMitarbeiter(options, `${searchTerm ?? ''}`.toLowerCase(), this.displayFn)
    )
  )

  touched = () => {
  }

  constructor(private readonly mitarbeiterService: MitarbeiterService) {
  }

  ngOnInit() {
    this.refreshMitarbeiterAuswahlOptionen()
  }

  writeValue(value: Mitarbeiter): void {
    if (value !== undefined) {
      // set value ctrl
      this.formControl.reset(value);
    }
    // set display ctrl
    this.searchControl.reset(this.displayFn(value))
  }

  registerOnChange(fn: any): void {
    this.formControl.valueChanges.subscribe(fn);
  }

  registerOnTouched(fn: () => void): void {
    this.touched = fn
  }

  setDisabledState(isDisabled: boolean) {
    if (isDisabled) {
      this.formControl.disable();
    } else {
      this.formControl.enable();
    }
  }

  displayFn(employee: Mitarbeiter | null): string {
    return employee ? `${employee.vorname} ${employee.nachname}` : '-';
  }

  onOptionSelected(event: MatAutocompleteSelectedEvent): void {
    this.formControl.setValue(event.option.value);
  }

  private refreshMitarbeiterAuswahlOptionen(): void {
    this.loadingSubject.next(true);
    this.mitarbeiterService.getMitarbeiter().pipe(finalize(() => this.loadingSubject.next(false))).subscribe(this.optionsSubject)
  }
}


export function filterMitarbeiter(mitarbeiterListe: Mitarbeiter[], searchTerm: string,
                                  displayFn?: (employee: Mitarbeiter) => string
):
  Mitarbeiter[] {
  return mitarbeiterListe.filter(m =>
    m.vorname.toLowerCase().includes(searchTerm) ||
    m.nachname.toLowerCase().includes(searchTerm) ||
    m.kennung.toLowerCase().includes(searchTerm) ||
    displayFn && displayFn(m).toLowerCase().includes(searchTerm)
  )
}
