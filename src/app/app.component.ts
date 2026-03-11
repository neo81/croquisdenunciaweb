import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, Inject, PLATFORM_ID, OnInit } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface AccidenteOption {
  COD_T_ACCIDENTE: string;
  X_ACCIDENTE: string;
}

interface BackgroundOption {
  file: string;
  label: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements AfterViewInit, OnDestroy, OnInit {
  @ViewChild('stageContainer', { static: true }) stageContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('stageWrapper', { static: true }) stageWrapper!: ElementRef<HTMLDivElement>;

  private readonly API_BASE_URL = 'http://test.lh.com/';
  public accidentesApi: AccidenteOption[] = [];

  private Konva: any = null;
  private stage: any = null;
  private layer: any = null;
  private backgroundLayer: any = null;
  private transformer: any = null;
  private backgroundImageNode: any = null;

  public isDrawingMode: boolean = false;
  public strokeColor: string = '#000000'; 
  private isPaint: boolean = false;
  private lastLine: any = null;

  public selectedNode: any = null;
  public leftIconos: string[] = ['icono1.png', 'icono2.png'];
  public rightIconos: string[] = ['icono3.png', 'icono4.png'];

  public backgrounds: BackgroundOption[] = [
    { file: 'foto1.jpg', label: 'Cruce' },
    { file: 'foto2.jpg', label: 'Diagonal' },
    { file: 'foto3.jpg', label: 'Rotonda' }
  ];
  
  public form = { tipoAccidente: '', tipoLugarSiniestro: '', tipoLugar: '', tipoColision: '', descripcion: '' };
  public selectedBackground: string = '';
  public savedJson: string = '';

  private readonly BASE_WIDTH = 1280;
  private readonly BASE_HEIGHT = 720;
  isBrowser = false;
  resizeObserver: ResizeObserver | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: Object, private http: HttpClient) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    this.cargarTiposAccidente();
  }

  private cargarTiposAccidente() {
    const url = `${this.API_BASE_URL}api/siniestros/T_ACCIDENTE`;
    this.http.get<AccidenteOption[]>(url).subscribe({
      next: (data) => this.accidentesApi = data,
      error: () => this.accidentesApi = [{ COD_T_ACCIDENTE: 'ERR', X_ACCIDENTE: 'Error API' }]
    });
  }

  async ngAfterViewInit(): Promise<void> {
    if (!this.isBrowser) return;
    const mod = await import('konva');
    this.Konva = (mod as any).default || mod;
    this.initKonva();
    this.setupResponsive();
    this.addGlobalListeners();
  }

  ngOnDestroy(): void {
    if (this.isBrowser) {
      this.resizeObserver?.disconnect();
      this.stage?.destroy();
    }
  }

  private initKonva() {
    this.stage = new this.Konva.Stage({
      container: this.stageContainer.nativeElement,
      width: this.BASE_WIDTH,
      height: this.BASE_HEIGHT
    });

    this.backgroundLayer = new this.Konva.Layer();
    this.layer = new this.Konva.Layer();
    this.stage.add(this.backgroundLayer, this.layer);

    this.createTransformer();

    this.stage.on('mousedown touchstart', (e: any) => this.handleMouseDown(e));
    this.stage.on('mousemove touchmove', (e: any) => this.handleMouseMove(e));
    this.stage.on('mouseup touchend', () => this.handleMouseUp());

    this.stage.on('click tap', (e: any) => {
      if (this.isDrawingMode) return;
      const target = e.target;
      if (target === this.stage || target === this.backgroundImageNode) {
        this.selectNode(null);
        return;
      }
      if (target.hasName('canvas-icon')) {
        this.selectNode(target);
      }
    });
  }

  private createTransformer() {
    this.transformer = new this.Konva.Transformer({
      rotateEnabled: true,
      enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      boundBoxFunc: (oldBox: any, newBox: any) => Math.abs(newBox.width) < 10 ? oldBox : newBox
    });
    this.layer.add(this.transformer);
  }

  public addText() {
    const textNode = new this.Konva.Text({
      text: 'Escribe aquí...',
      x: 150, y: 150, fontSize: 30,
      fontFamily: 'Arial', fill: this.strokeColor,
      draggable: true, name: 'canvas-icon' 
    });
    textNode.on('dblclick dbltap', () => {
      const newText = prompt('Editar texto:', textNode.text());
      if (newText !== null) { textNode.text(newText); this.layer.draw(); }
    });
    this.layer.add(textNode);
    this.selectNode(textNode);
  }

  public toggleDrawingMode() {
    this.isDrawingMode = !this.isDrawingMode;
    if (this.isDrawingMode) this.selectNode(null);
  }

  public loadCroquis() {
    if (!this.savedJson) return;
    try {
      this.selectNode(null);
      const stageData = JSON.parse(this.savedJson);
      if (this.stage) this.stage.destroy();
      this.stageContainer.nativeElement.innerHTML = '';
      this.stage = this.Konva.Node.create(stageData, this.stageContainer.nativeElement);
      const layers = this.stage.getLayers();
      this.backgroundLayer = layers[0];
      this.layer = layers[1];

      const images = this.stage.find('Image');
      images.forEach((imgNode: any) => {
        const nativeImg = new Image();
        nativeImg.src = imgNode.attrs.src; 
        nativeImg.onload = () => {
          imgNode.image(nativeImg);
          this.stage.batchDraw();
        };
      });

      this.createTransformer();
      this.stage.on('mousedown touchstart', (e: any) => this.handleMouseDown(e));
      this.stage.on('mousemove touchmove', (e: any) => this.handleMouseMove(e));
      this.stage.on('mouseup touchend', () => this.handleMouseUp());
      
      this.fitStageToWrapper();
      this.stage.batchDraw();
    } catch (e) { alert("Error al cargar JSON."); }
  }

  private handleMouseDown(e: any) {
    if (!this.isDrawingMode) return;
    this.isPaint = true;
    const pos = this.stage.getPointerPosition();
    const transform = this.stage.getAbsoluteTransform().copy().invert();
    const logicPos = transform.point(pos);
    this.lastLine = new this.Konva.Line({
      stroke: this.strokeColor, strokeWidth: 4, points: [logicPos.x, logicPos.y],
      draggable: true, name: 'canvas-icon', lineCap: 'round', lineJoin: 'round', hitStrokeWidth: 15
    });
    this.layer.add(this.lastLine);
  }

  private handleMouseMove(e: any) {
    if (!this.isPaint || !this.isDrawingMode) return;
    const pos = this.stage.getPointerPosition();
    const transform = this.stage.getAbsoluteTransform().copy().invert();
    const logicPos = transform.point(pos);
    const newPoints = this.lastLine.points().concat([logicPos.x, logicPos.y]);
    this.lastLine.points(newPoints);
    this.layer.batchDraw();
  }

  private handleMouseUp() { if (this.isPaint) { this.isPaint = false; this.isDrawingMode = false; this.selectNode(this.lastLine); } }

  public selectNode(node: any | null) {
    if (!node) {
      this.selectedNode = null;
      this.transformer.nodes([]);
    } else {
      this.selectedNode = node;
      this.transformer.nodes([node]);
      this.transformer.moveToTop();
    }
    this.layer.draw();
  }

  public onSelectBackground(fileName: string) {
    if (!this.isBrowser || !this.Konva) return;
    if (!fileName) { 
      if (this.backgroundImageNode) { this.backgroundImageNode.destroy(); this.backgroundImageNode = null; }
      this.backgroundLayer.draw();
      return; 
    }
    const img = new Image();
    img.src = `assets/backgrounds/${fileName}`;
    img.onload = () => {
      if (this.backgroundImageNode) this.backgroundImageNode.destroy();
      this.backgroundImageNode = new this.Konva.Image({ x: 0, y: 0, image: img, width: this.BASE_WIDTH, height: this.BASE_HEIGHT, listening: true, src: img.src });
      this.backgroundLayer.add(this.backgroundImageNode);
      this.backgroundLayer.batchDraw();
    };
  }

  public flipHorizontal() { if (this.selectedNode) { this.selectedNode.scaleX(this.selectedNode.scaleX() * -1); this.layer.draw(); } }
  public flipVertical() { if (this.selectedNode) { this.selectedNode.scaleY(this.selectedNode.scaleY() * -1); this.layer.draw(); } }
  public duplicateSelected() { if (!this.selectedNode) return; const clone = this.selectedNode.clone({ x: this.selectedNode.x() + 20, y: this.selectedNode.y() + 20 }); this.layer.add(clone); this.selectNode(clone); }
  public bringToFront() { if (this.selectedNode) { this.selectedNode.moveToTop(); this.transformer.moveToTop(); this.layer.draw(); } }
  public clearCanvas() { this.layer.find('.canvas-icon').forEach((n: any) => n.destroy()); this.selectNode(null); }
  public saveCroquis() { this.savedJson = JSON.stringify(this.stage.toJSON(), null, 2); }
  public exportImage() { this.selectNode(null); const link = document.createElement('a'); link.download = 'croquis.png'; link.href = this.stage.toDataURL({ pixelRatio: 2 }); link.click(); }

  public onHtmlDragStart(evt: DragEvent, icon: string) { evt.dataTransfer?.setData('text/plain', icon); }
  public onDragOver(evt: DragEvent) { evt.preventDefault(); }
  public onDropToStage(evt: DragEvent) {
    evt.preventDefault();
    const icon = evt.dataTransfer?.getData('text/plain');
    if (!icon) return;
    this.stage.setPointersPositions(evt);
    const pos = this.stage.getPointerPosition();
    const transform = this.stage.getAbsoluteTransform().copy().invert();
    const logicPos = transform.point(pos);
    this.addIcon(icon, logicPos.x, logicPos.y);
  }

  public onHtmlClickAdd(icon: string) { this.addIcon(icon, this.BASE_WIDTH / 2, this.BASE_HEIGHT / 2); }
  private addIcon(iconFile: string, x: number, y: number) {
    const img = new Image();
    img.src = `assets/iconos/${iconFile}`;
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const kImg = new this.Konva.Image({ x, y, image: img, width: w, height: h, offsetX: w / 2, offsetY: h / 2, draggable: true, name: 'canvas-icon', src: img.src });
      this.layer.add(kImg);
      this.selectNode(kImg);
    };
  }

  private setupResponsive() {
    this.resizeObserver = new ResizeObserver(() => this.fitStageToWrapper());
    this.resizeObserver.observe(this.stageWrapper.nativeElement);
  }
  private fitStageToWrapper() {
    if (!this.stage || !this.stageWrapper) return;
    const container = this.stageWrapper.nativeElement;
    const scale = container.clientWidth / this.BASE_WIDTH;
    this.stage.width(this.BASE_WIDTH * scale);
    this.stage.height(this.BASE_HEIGHT * scale);
    this.stage.scale({ x: scale, y: scale });
    this.stage.batchDraw();
  }
  private addGlobalListeners() {
    window.addEventListener('keydown', (e) => { if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedNode) { this.selectedNode.destroy(); this.selectNode(null); } });
  }
}