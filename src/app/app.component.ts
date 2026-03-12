// app.component.ts
import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

// Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatInputModule } from '@angular/material/input';

import { CanvasEditorComponent } from './canvas-editor/canvas-editor.component';
import { CANVAS_CONFIG, BackgroundOption } from './canvas.config';

interface AccidenteOption {
  COD_T_ACCIDENTE: string;
  X_ACCIDENTE: string;
}

interface SiniestroForm {
  tipoAccidente: string;
  tipoLugarSiniestro: string;
  tipoLugar: string;
  tipoColision: string;
  descripcion: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    // Material
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatDividerModule,
    MatInputModule,
    // App
    CanvasEditorComponent,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {

  @ViewChild('canvasEditor') canvasEditor!: CanvasEditorComponent;

  private readonly API_BASE_URL = 'http://test.lh.com/';

  public form: SiniestroForm = {
    tipoAccidente: '',
    tipoLugarSiniestro: '',
    tipoLugar: '',
    tipoColision: '',
    descripcion: '',
  };

  public accidentesApi: AccidenteOption[] = [];
  public backgrounds: BackgroundOption[] = [...CANVAS_CONFIG.BACKGROUNDS];
  public selectedBackground: string = '';
  public strokeColor: string = '#1565c0';
  public savedJson: string = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.cargarTiposAccidente();
  }

  private cargarTiposAccidente(): void {
    const url = `${this.API_BASE_URL}api/siniestros/T_ACCIDENTE`;
    this.http.get<AccidenteOption[]>(url).subscribe({
      next: (data) => (this.accidentesApi = data),
      error: () =>
        (this.accidentesApi = [{ COD_T_ACCIDENTE: 'ERR', X_ACCIDENTE: 'Error al cargar' }]),
    });
  }

  // ── Toolbar actions ──────────────────────────────────────────

  public onSelectBackground(fileName: string): void {
    this.selectedBackground = fileName;
    this.canvasEditor.applyBackground(fileName);
  }

  public toggleDrawingMode(): void { this.canvasEditor.toggleDrawingMode(); }
  public addText(): void           { this.canvasEditor.addText(); }
  public flipHorizontal(): void    { this.canvasEditor.flipHorizontal(); }
  public flipVertical(): void      { this.canvasEditor.flipVertical(); }
  public duplicateSelected(): void { this.canvasEditor.duplicateSelected(); }
  public bringToFront(): void      { this.canvasEditor.bringToFront(); }
  public exportImage(): void       { this.canvasEditor.exportImage(); }

  public clearCanvas(): void {
    this.selectedBackground = '';
    this.canvasEditor.clearCanvas();
  }

  public saveCroquis(): void  { this.canvasEditor.saveToJson(); }
  public loadCroquis(): void  { this.canvasEditor.loadFromJson(this.savedJson); }

  // ── Delegated getters ────────────────────────────────────────

  public get isDrawingMode(): boolean { return this.canvasEditor?.isDrawingMode ?? false; }
  public get selectedNode(): any      { return this.canvasEditor?.selectedNode ?? null; }
  public get hasBackground(): boolean { return this.canvasEditor?.hasBackground ?? false; }
}
