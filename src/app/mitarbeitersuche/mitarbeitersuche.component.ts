import {Component, forwardRef, HostListener, Input, OnChanges, OnInit, SimpleChanges} from '@angular/core';
import {CommonModule} from '@angular/common';
import {
  AbstractControl,
  ControlValueAccessor,
  FormControl,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  ValidationErrors,
  Validator,
  Validators
} from "@angular/forms";
import {MatAutocompleteModule, MatAutocompleteSelectedEvent} from "@angular/material/autocomplete";
import {
  BehaviorSubject, combineLatest,
  delay,
  distinctUntilChanged, filter,
  finalize,
  map,
  merge,
  Observable,
  of,
  ReplaySubject,
  shareReplay,
  startWith, tap, throwError
} from "rxjs";
import {MatInputModule} from "@angular/material/input";
import {BooleanInput, coerceBooleanProperty} from "@angular/cdk/coercion";
import {MatIconModule} from "@angular/material/icon";

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
  public getMitarbeiter(type: Zustaendigkeit): Observable<Mitarbeiter[]> {
    switch (type) {
      case Zustaendigkeit.BERATER:
        return of([...MOCK_MITARBEITER]).pipe(delay(10000))
      default:
        return throwError(() => new Error('Zustaendigkeit nicht bekannt'))
    }

  }
}

@Component({
  selector: 'app-mitarbeitersuche',
  standalone: true,
  imports: [CommonModule, MatInputModule, MatAutocompleteModule, ReactiveFormsModule, MatIconModule],
  templateUrl: './mitarbeitersuche.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MitarbeitersucheComponent),
      multi: true
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => MitarbeitersucheComponent),
      multi: true
    },
    MitarbeiterService
  ]
})
export class MitarbeitersucheComponent implements ControlValueAccessor, Validator, OnChanges, OnInit {

  @Input() label: string = '';
  @Input() type: Zustaendigkeit = Zustaendigkeit.BERATER;

  private _required = true;
  get required() {
    return this._required;
  }

  @Input() set required(val: BooleanInput) {
    this._required = coerceBooleanProperty(val);
    if (this.required) {
      this.formControl.setValidators(Validators.required)
      this.searchControl.setValidators(Validators.required)
    } else {
      this.formControl.removeValidators(Validators.required);
      this.searchControl.removeValidators(Validators.required);
    }
  }

  /**
   * Die initialKennung wird sofern gesetzt höher priorisiert, wie die initiale Auswahl der Reactive-Form-Controller.
   * @param val mitarbeiter kennung
   */
  @Input() set initialKennung(val: string | undefined) {
    this.initialKennungSubject.next(val);
  }

  get initialKennung() {
    return this.initialKennungSubject.getValue();
  }

  private readonly initialKennungSubject = new BehaviorSubject<string | undefined>('')

  @Input() set restrictedKennung(val: string[] | undefined) {
    this.restrictedKennungenSubject.next(val)
  };

  get restrictedKennung() {
    return this.restrictedKennungenSubject.getValue()
  }

  private readonly loadingSubject = new ReplaySubject<boolean>(1);
  readonly isLoading$ = this.loadingSubject.asObservable();
  private readonly optionsSubject = new BehaviorSubject<Mitarbeiter[]>([]);
  private readonly restrictedKennungenSubject = new BehaviorSubject<string[] | undefined>(undefined);

  readonly formControl = new FormControl<Mitarbeiter | null>(null, Validators.required);
  readonly searchControl = new FormControl<string>('');

  readonly filteredOptions$: Observable<Mitarbeiter[]> =
    // install trigger $
    merge(this.optionsSubject.asObservable(), this.searchControl.valueChanges, this.restrictedKennungenSubject.asObservable())
      .pipe(
        // trigger to search text
        map(() => this.searchControl.value),
        map((value) => typeof value === 'string' ? value : ''),
        // relax
        distinctUntilChanged(),
        // trigger initial filter options
        startWith(''),
        // heavy filter magic
        map((searchTerm: string | null): Mitarbeiter[] =>
          filterMitarbeiter(!!this.restrictedKennung?.length
              ? filterForRestrictedKennungen(this.optionsSubject.getValue(), this.restrictedKennung)
              : [...this.optionsSubject.getValue()],
            (searchTerm ?? '').toLowerCase(),
            this.displayFn
          )
        ),
        // boost performance if there are multiple sub.
        shareReplay()
      )

  @HostListener('click')
  touched = () => {
  }

  constructor(private readonly mitarbeiterService: MitarbeiterService) {
  }

  ngOnInit(): void {
    combineLatest(
      [
        this.initialKennungSubject.pipe(filter((initialKennung) => !!initialKennung?.trim())),
        this.optionsSubject.pipe(filter((options) => !!options.length))
      ]
    ).pipe(
      map(([initialKennung, options]) => options.find(o => o.kennung === initialKennung)),
      filter((initialerMitarbeiter: Mitarbeiter | undefined) => !!initialerMitarbeiter),
      map((initialerMitarbeiter: Mitarbeiter | undefined): Mitarbeiter => initialerMitarbeiter as Mitarbeiter)
    ).subscribe((initialerMitarbeiter: Mitarbeiter) => this.writeValue(initialerMitarbeiter))
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('type' in changes && changes['type'].currentValue
      && changes['type'].previousValue !== changes['type'].currentValue) {
      this.refreshMitarbeiterAuswahlOptionen()
    }
    if ('initialKennung' in changes && changes['initialKennung'].currentValue) {

    }
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

  setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.formControl.disable();
    } else {
      this.formControl.enable();
    }
  }

  displayFn(employee: Mitarbeiter | null): string {
    return employee ? `${employee.vorname} ${employee.nachname}` : '';
  }

  onOptionSelected(event: MatAutocompleteSelectedEvent): void {
    this.formControl.setValue(event.option.value);
  }

  private refreshMitarbeiterAuswahlOptionen(): void {
    this.loadingSubject.next(true);
    this.mitarbeiterService.getMitarbeiter(this.type)
      .pipe(
        finalize(() => this.loadingSubject.next(false))
      )
      .subscribe(this.optionsSubject)
  }

  validate(control: AbstractControl): ValidationErrors | null {
    return this.formControl.errors
  }
}

export function filterForRestrictedKennungen(mitarbeiterListe: Mitarbeiter[], whiteList: string[]): Mitarbeiter[] {
  return mitarbeiterListe.filter((m) => whiteList.includes(m.kennung));
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
