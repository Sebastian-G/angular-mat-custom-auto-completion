import {Component} from '@angular/core';
import {FormBuilder} from "@angular/forms";
import {Mitarbeiter, Zustaendigkeit} from "./mitarbeitersuche/mitarbeitersuche.component";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  readonly fg = this.fb.group<{ mitarbeiter: Mitarbeiter | null }>({
    mitarbeiter: null
  })

  readonly Zustaendigkeit = Zustaendigkeit;

  constructor(private readonly fb: FormBuilder) {
    this.fg.setValue({
      mitarbeiter: {
        kennung: '12345',
        nachname: 'Mustermann',
        vorname: 'Max',
        zustaendigkeit: Zustaendigkeit.BERATER
      } as Mitarbeiter
    })
  }
}
