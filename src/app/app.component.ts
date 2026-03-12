// ============================================================
// app.component.ts
// Componente raíz. Orquesta el formulario, la toolbar y
// delega toda la lógica del canvas a CanvasEditorComponent.
// ============================================================

import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
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
  imports: [CommonModule, FormsModule, CanvasEditorComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {

  // Referencia al canvas para llamar sus métodos desde la toolbar
  @ViewChild('canvasEditor') canvasEditor!: CanvasEditorComponent;

  private readonly API_BASE_URL = 'http://test.lh.com/';

  // ── Datos del formulario ─────────────────────────────────────
  public form: SiniestroForm = {
    tipoAccidente: '',
    tipoLugarSiniestro: '',
    tipoLugar: '',
    tipoColision: '',
    descripcion: '',
  };

  // ── Opciones cargadas desde API ──────────────────────────────
  public accidentesApi: AccidenteOption[] = [];

  // ── Opciones de fondo desde configuración ───────────────────
  public backgrounds: BackgroundOption[] = [...CANVAS_CONFIG.BACKGROUNDS];
  public selectedBackground: string = '';

  // ── Estado de herramientas ───────────────────────────────────
  public strokeColor: string = '#000000';
  public savedJson: string = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.cargarTiposAccidente();
  }

  // ── API ──────────────────────────────────────────────────────

  private cargarTiposAccidente(): void {
    const url = `${this.API_BASE_URL}api/siniestros/T_ACCIDENTE`;
    this.http.get<AccidenteOption[]>(url).subscribe({
      next: (data) => (this.accidentesApi = data),
      error: () =>
        (this.accidentesApi = [{ COD_T_ACCIDENTE: 'ERR', X_ACCIDENTE: 'Error al cargar' }]),
    });
  }

  // ── Eventos de la toolbar ────────────────────────────────────

  public onSelectBackground(fileName: string): void {
    this.selectedBackground = fileName;
    this.canvasEditor.applyBackground(fileName);
  }

  public toggleDrawingMode(): void {
    this.canvasEditor.toggleDrawingMode();
  }

  public addText(): void {
    this.canvasEditor.addText();
  }

  public flipHorizontal(): void {
    this.canvasEditor.flipHorizontal();
  }

  public flipVertical(): void {
    this.canvasEditor.flipVertical();
  }

  public duplicateSelected(): void {
    this.canvasEditor.duplicateSelected();
  }

  public bringToFront(): void {
    this.canvasEditor.bringToFront();
  }

  public clearCanvas(): void {
    this.selectedBackground = '';
    this.canvasEditor.clearCanvas();
  }

  public saveCroquis(): void {
    this.canvasEditor.saveToJson();
  }

  public loadCroquis(): void {
    this.canvasEditor.loadFromJson(this.savedJson);
  }

  public exportImage(): void {
    this.canvasEditor.exportImage();
  }

  // ── Getters para el template (delegados al canvas) ───────────

  public get isDrawingMode(): boolean {
    return this.canvasEditor?.isDrawingMode ?? false;
  }

  public get selectedNode(): any {
    return this.canvasEditor?.selectedNode ?? null;
  }

  public get hasBackground(): boolean {
    return this.canvasEditor?.hasBackground ?? false;
  }
}
