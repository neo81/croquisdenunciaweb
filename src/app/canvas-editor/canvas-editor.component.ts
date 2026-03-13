// canvas-editor/canvas-editor.component.ts
// Sin cambios en lógica. Solo se agregan imports de Material
// para los elementos del template (sidebar, iconos).

import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  Input,
  Output,
  EventEmitter,
  Inject,
  PLATFORM_ID,
  ChangeDetectorRef,
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Angular Material
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';

import { CANVAS_CONFIG, IconOption } from '../canvas.config';

@Component({
  selector: 'app-canvas-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, MatTooltipModule, MatCardModule],
  templateUrl: './canvas-editor.component.html',
  styleUrls: ['./canvas-editor.component.css'],
})
export class CanvasEditorComponent implements AfterViewInit, OnDestroy, OnChanges {

  // ── Inputs / Outputs ────────────────────────────────────────
  @Input() backgroundFile: string = '';
  @Input() strokeColor: string = '#000000';
  @Input() savedJson: string = '';
  @Output() savedJsonChange = new EventEmitter<string>();

  // Notifica al padre el fondo restaurado al cargar un JSON
  @Output() backgroundFileChange = new EventEmitter<string>();

  // ── ViewChildren ────────────────────────────────────────────
  @ViewChild('stageContainer', { static: true }) stageContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('stageWrapper',   { static: true }) stageWrapper!:   ElementRef<HTMLDivElement>;

  // ── Estado público ───────────────────────────────────────────
  public isDrawingMode = false;
  public selectedNode: any = null;
  public hasBackground = false;

  public leftIcons:  IconOption[] = [...CANVAS_CONFIG.LEFT_ICONS];
  public rightIcons: IconOption[] = [...CANVAS_CONFIG.RIGHT_ICONS];

  // ── Estado privado ───────────────────────────────────────────
  private Konva: any = null;
  private stage: any = null;
  private layer: any = null;
  private backgroundLayer: any = null;
  private transformer: any = null;
  private backgroundImageNode: any = null;
  private isPaint = false;
  private lastLine: any = null;
  private resizeObserver: ResizeObserver | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private isBrowser: boolean;

  private readonly BASE_WIDTH  = CANVAS_CONFIG.CANVAS_WIDTH;
  private readonly BASE_HEIGHT = CANVAS_CONFIG.CANVAS_HEIGHT;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  // ── Lifecycle ────────────────────────────────────────────────

  async ngAfterViewInit(): Promise<void> {
    if (!this.isBrowser) return;
    const mod = await import('konva');
    this.Konva = (mod as any).default || mod;
    this.initKonva();
    this.setupResponsive();
    this.addGlobalListeners();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['backgroundFile'] && !changes['backgroundFile'].firstChange && this.Konva) {
      this.applyBackground(this.backgroundFile);
    }
  }

  ngOnDestroy(): void {
    if (this.isBrowser) {
      this.resizeObserver?.disconnect();
      this.stage?.destroy();
      if (this.keydownHandler) {
        window.removeEventListener('keydown', this.keydownHandler);
      }
    }
  }

  // ── Inicialización ───────────────────────────────────────────

  private initKonva(): void {
    this.stage = new this.Konva.Stage({
      container: this.stageContainer.nativeElement,
      width: this.BASE_WIDTH,
      height: this.BASE_HEIGHT,
    });
    this.backgroundLayer = new this.Konva.Layer();
    this.layer = new this.Konva.Layer();
    this.stage.add(this.backgroundLayer, this.layer);
    this.createTransformer();
    this.setupStageListeners();
  }

  private createTransformer(): void {
    this.transformer = new this.Konva.Transformer({
      rotateEnabled: true,
      enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      boundBoxFunc: (_oldBox: any, newBox: any) =>
        Math.abs(newBox.width) < 10 ? _oldBox : newBox,
    });
    this.layer.add(this.transformer);
  }

  private setupStageListeners(): void {
    this.stage.on('mousedown touchstart', (e: any) => this.handleMouseDown(e));
    this.stage.on('mousemove touchmove',  (e: any) => this.handleMouseMove(e));
    this.stage.on('mouseup touchend',     ()        => this.handleMouseUp());
    this.stage.on('click tap', (e: any) => {
      if (this.isDrawingMode) return;
      const target = e.target;
      if (target === this.stage || target.parent === this.backgroundLayer) {
        this.selectNode(null);
        return;
      }
      if (target.hasName('canvas-icon')) this.selectNode(target);
    });
  }

  private setupResponsive(): void {
    this.resizeObserver = new ResizeObserver(() => this.fitStageToWrapper());
    this.resizeObserver.observe(this.stageWrapper.nativeElement);
  }

  private addGlobalListeners(): void {
    this.keydownHandler = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedNode) {
        this.selectedNode.destroy();
        this.selectNode(null);
      }
    };
    window.addEventListener('keydown', this.keydownHandler);
  }

  private fitStageToWrapper(): void {
    if (!this.stage || !this.stageWrapper) return;
    const container = this.stageWrapper.nativeElement;
    const scale = container.clientWidth / this.BASE_WIDTH;
    this.stage.width(this.BASE_WIDTH * scale);
    this.stage.height(this.BASE_HEIGHT * scale);
    this.stage.scale({ x: scale, y: scale });
    this.stage.batchDraw();
  }

  // ── Utilidades privadas ──────────────────────────────────────

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = src;
      img.onload  = () => resolve(img);
      img.onerror = () => reject(`No se pudo cargar: ${src}`);
    });
  }

  private getLogicalPosition(): { x: number; y: number } {
    const pos = this.stage.getPointerPosition();
    const transform = this.stage.getAbsoluteTransform().copy().invert();
    return transform.point(pos);
  }

  private createWarningIcon(x: number, y: number): void {
    const group  = new this.Konva.Group({ x, y, name: 'canvas-icon', draggable: true });
    const circle = new this.Konva.Circle({ radius: 15, fill: '#ffc107', stroke: '#000', strokeWidth: 2 });
    const text   = new this.Konva.Text({ text: '!', fontSize: 20, fontStyle: 'bold', fill: '#000', offsetX: 4, offsetY: 10 });
    group.add(circle, text);
    this.layer.add(group);
  }

  // ── Fondo ────────────────────────────────────────────────────

  public async applyBackground(fileName: string): Promise<void> {
    if (!this.isBrowser || !this.Konva) return;
    if (!fileName) {
      this.clearCanvasObjects();
      this.backgroundImageNode?.destroy();
      this.backgroundImageNode = null;
      this.backgroundLayer.draw();
      this.hasBackground = false;
      return;
    }
    try {
      const src = `${CANVAS_CONFIG.ASSETS_BASE_URL}backgrounds/${fileName}`;
      const img = await this.loadImage(src);
      this.backgroundImageNode?.destroy();
      this.backgroundImageNode = new this.Konva.Image({
        x: 0, y: 0, image: img,
        width: this.BASE_WIDTH, height: this.BASE_HEIGHT,
        listening: true, src,
      });
      this.backgroundLayer.add(this.backgroundImageNode);
      this.backgroundLayer.batchDraw();
      this.hasBackground = true;
    } catch {
      alert('Error: El fondo no está disponible.');
      this.hasBackground = false;
      this.cdr.detectChanges();
    }
  }

  // ── Herramientas públicas ────────────────────────────────────

  public toggleDrawingMode(): void {
    if (!this.hasBackground) return;
    this.isDrawingMode = !this.isDrawingMode;
    if (this.isDrawingMode) this.selectNode(null);
  }

  public addText(): void {
    if (!this.hasBackground) return;
    const textNode = new this.Konva.Text({
      text: 'Escribe aquí...', x: 150, y: 150,
      fontSize: 30, fontFamily: 'Arial',
      fill: this.strokeColor, draggable: true, name: 'canvas-icon',
    });
    textNode.on('dblclick dbltap', () => {
      const newText = prompt('Editar texto:', textNode.text());
      if (newText !== null) { textNode.text(newText); this.layer.draw(); }
    });
    this.layer.add(textNode);
    this.selectNode(textNode);
  }

  public flipHorizontal(): void  { if (this.selectedNode) { this.selectedNode.scaleX(this.selectedNode.scaleX() * -1); this.layer.draw(); } }
  public flipVertical(): void    { if (this.selectedNode) { this.selectedNode.scaleY(this.selectedNode.scaleY() * -1); this.layer.draw(); } }

  public duplicateSelected(): void {
    if (!this.selectedNode) return;
    const clone = this.selectedNode.clone({ x: this.selectedNode.x() + 20, y: this.selectedNode.y() + 20 });
    this.layer.add(clone);
    this.selectNode(clone);
  }

  public bringToFront(): void {
    if (this.selectedNode) { this.selectedNode.moveToTop(); this.transformer.moveToTop(); this.layer.draw(); }
  }

  public clearCanvas(): void {
    this.clearCanvasObjects();
    this.backgroundImageNode?.destroy();
    this.backgroundImageNode = null;
    this.backgroundLayer.draw();
    this.hasBackground = false;
  }

  private clearCanvasObjects(): void {
    if (this.layer) {
      this.layer.find('.canvas-icon').forEach((n: any) => n.destroy());
      this.selectNode(null);
      this.layer.draw();
    }
  }

  public saveToJson(): void {
    const stageObj = this.stage.toObject();
    stageObj.attrs = stageObj.attrs || {};
    stageObj.attrs.customBackgroundFile = this.backgroundFile;
    this.savedJsonChange.emit(JSON.stringify(stageObj, null, 2));
  }

  public async loadFromJson(json: string): Promise<void> {
    if (!json) return;
    try {
      const stageData = JSON.parse(json);
      const backgroundToRestore: string = stageData.attrs?.customBackgroundFile ?? '';

      this.selectNode(null);
      this.stage.destroy();
      this.stageContainer.nativeElement.innerHTML = '';

      this.stage = this.Konva.Node.create(stageData, this.stageContainer.nativeElement);
      const layers = this.stage.getLayers();
      this.backgroundLayer = layers[0];
      this.layer = layers[1];

      await Promise.all(
        this.stage.find('Image').map(async (imgNode: any) => {
          try {
            const nativeImg = await this.loadImage(imgNode.attrs.src);
            imgNode.image(nativeImg);
            if (imgNode.parent === this.backgroundLayer) this.backgroundImageNode = imgNode;
          } catch (err) {
            console.warn(err);
            if (imgNode.parent !== this.backgroundLayer) this.createWarningIcon(imgNode.x(), imgNode.y());
            imgNode.destroy();
          }
        })
      );

      this.createTransformer();
      this.setupStageListeners();
      this.fitStageToWrapper();
      this.hasBackground = !!backgroundToRestore;
      this.backgroundFileChange.emit(backgroundToRestore); // ← sincroniza selector del padre
      this.cdr.detectChanges();
      this.stage.batchDraw();
    } catch (e) {
      console.error(e);
      alert('Error crítico al reconstruir el croquis.');
    }
  }

  public exportImage(): void {
    this.selectNode(null);
    const link = document.createElement('a');
    link.download = 'croquis.png';
    link.href = this.stage.toDataURL({ pixelRatio: 2 });
    link.click();
  }

  // ── Drag & Drop ──────────────────────────────────────────────

  public onHtmlDragStart(evt: DragEvent, iconFile: string): void { evt.dataTransfer?.setData('text/plain', iconFile); }
  public onDragOver(evt: DragEvent): void { evt.preventDefault(); }

  public onDropToStage(evt: DragEvent): void {
    evt.preventDefault();
    if (!this.hasBackground) return;
    const iconFile = evt.dataTransfer?.getData('text/plain');
    if (!iconFile) return;
    this.stage.setPointersPositions(evt);
    const logicPos = this.getLogicalPosition();
    this.addIconToCanvas(iconFile, logicPos.x, logicPos.y);
  }

  public onIconClick(iconFile: string): void {
    if (!this.hasBackground) return;
    this.addIconToCanvas(iconFile, this.BASE_WIDTH / 2, this.BASE_HEIGHT / 2);
  }

  private async addIconToCanvas(iconFile: string, x: number, y: number): Promise<void> {
    try {
      const src = `${CANVAS_CONFIG.ASSETS_BASE_URL}iconos/${iconFile}`;
      const img = await this.loadImage(src);
      const w = img.naturalWidth, h = img.naturalHeight;
      const kImg = new this.Konva.Image({
        x, y, image: img, width: w, height: h,
        offsetX: w / 2, offsetY: h / 2,
        draggable: true, name: 'canvas-icon', src,
      });
      this.layer.add(kImg);
      this.selectNode(kImg);
    } catch {
      alert('Error: El icono no se pudo cargar.');
    }
  }

  // ── Dibujo libre ─────────────────────────────────────────────

  private handleMouseDown(_e: any): void {
    if (!this.isDrawingMode) return;
    this.isPaint = true;
    const lp = this.getLogicalPosition();
    this.lastLine = new this.Konva.Line({
      stroke: this.strokeColor, strokeWidth: 4,
      points: [lp.x, lp.y],
      draggable: true, name: 'canvas-icon',
      lineCap: 'round', lineJoin: 'round', hitStrokeWidth: 15,
    });
    this.layer.add(this.lastLine);
  }

  private handleMouseMove(_e: any): void {
    if (!this.isPaint || !this.isDrawingMode) return;
    const lp = this.getLogicalPosition();
    this.lastLine.points(this.lastLine.points().concat([lp.x, lp.y]));
    this.layer.batchDraw();
  }

  private handleMouseUp(): void {
    if (this.isPaint) { this.isPaint = false; this.isDrawingMode = false; this.selectNode(this.lastLine); }
  }

  // ── Selección ────────────────────────────────────────────────

  public selectNode(node: any | null): void {
    if (!this.transformer) return;
    this.selectedNode = node;
    this.transformer.nodes(node ? [node] : []);
    if (node) this.transformer.moveToTop();
    this.layer.draw();
  }
}
