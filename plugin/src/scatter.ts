import uPlot from 'uplot';
import {
  FALLBACK_COLOR,
  FieldType,
  formattedValueToString,
  GrafanaTheme2,
  colorManipulator,
} from '@grafana/data';
import {
  AxisPlacement,
  ScaleDirection,
  ScaleOrientation,
  VisibilityMode,
} from '@grafana/schema';
import { UPlotConfigBuilder } from '@grafana/ui';

type FacetedData = any;
type FacetSeries = any;

import { XYSeries, FieldConfig as PanelFieldConfig, PointShape } from './panelcfg.gen';

// --- Implementação do Quadtree (Reaproveitado do XYChart nativo) ---
// Esta estrutura é usada para a detecção de 'hover' (tooltip) de alta performance.
// Não foi modificada, apenas reaproveitada.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  sidx?: number; // Índice da Série
  didx?: number; // Índice do Dado (ponto)
}
export class Quadtree {
  root: Node;
  constructor(x: number, y: number, w: number, h: number) {
    this.root = new Node(x, y, w, h, 0);
  }
  clear() {
    this.root.clear();
  }
  add(rect: Rect) {
    this.root.add(rect);
  }
  get(x: number, y: number, w: number, h: number, fn: (rect: Rect) => void) {
    this.root.get(x, y, w, h, fn);
  }
}
class Node {
  x: number;
  y: number;
  w: number;
  h: number;
  max: number;
  nodes: Node[] = [];
  rects: Rect[] = [];
  constructor(x: number, y: number, w: number, h: number, lvl: number) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.max = (lvl + 1) * 10;
  }
  clear() {
    this.nodes = [];
    this.rects = [];
  }
  add(rect: Rect) {
    if (this.nodes.length > 0) {
      this.findNode(rect).add(rect);
      return;
    }
    this.rects.push(rect);
    if (this.rects.length > this.max && this.w > 10 && this.h > 10) {
      this.split();
      let r;
      while ((r = this.rects.pop())) {
        this.findNode(r).add(r);
      }
    }
  }
  findNode(rect: Rect): Node {
    let hw = this.w / 2;
    let hh = this.h / 2;
    let hx = this.x + hw;
    let hy = this.y + hh;
    if (rect.x < hx) {
      return rect.y < hy ? this.nodes[0] : this.nodes[2];
    }
    return rect.y < hy ? this.nodes[1] : this.nodes[3];
  }
  split() {
    let hw = this.w / 2;
    let hh = this.h / 2;
    let hx = this.x + hw;
    let hy = this.y + hh;
    let lvl = this.max / 10;
    this.nodes[0] = new Node(this.x, this.y, hw, hh, lvl);
    this.nodes[1] = new Node(hx, this.y, hw, hh, lvl);
    this.nodes[2] = new Node(this.x, hy, hw, hh, lvl);
    this.nodes[3] = new Node(hx, hy, hw, hh, lvl);
  }
  get(x: number, y: number, w: number, h: number, fn: (rect: Rect) => void) {
    for (let i = 0; i < this.rects.length; i++) {
      fn(this.rects[i]);
    }
    if (this.nodes.length > 0) {
      let hw = this.w / 2;
      let hh = this.h / 2;
      let hx = this.x + hw;
      let hy = this.y + hh;
      if (x < hx) {
        if (y < hy) {
          this.nodes[0].get(x, y, w, h, fn);
        }
        if (y + h > hy) {
          this.nodes[2].get(x, y, w, h, fn);
        }
      }
      if (x + w > hx) {
        if (y < hy) {
          this.nodes[1].get(x, y, w, h, fn);
        }
        if (y + h > hy) {
          this.nodes[3].get(x, y, w, h, fn);
        }
      }
    }
  }
}
// --- Fim do Quadtree ---

export function pointWithin(px: number, py: number, x: number, y: number, x2: number, y2: number): boolean {
  return px >= x && px <= x2 && py >= y && py <= y2;
}

interface DrawBubblesOpts {
  // Callback para alimentar o Quadtree
  each: (u: uPlot, seriesIdx: number, dataIdx: number, lft: number, top: number, wid: number, hgt: number) => void;
  disp: {
    size: { values: (u: uPlot, seriesIdx: number) => number[] };
    color: { values: (u: uPlot, seriesIdx: number) => string[] };
  };
}

/**
 * PathBuilder customizado do uPlot (forkado do nativo).
 * Contém modificações para suportar a funcionalidade do nosso plugin.
 */
function drawBubblesFactory(opts: DrawBubblesOpts, xySeries: XYSeries[]) {
  const drawBubbles: uPlot.Series.PathBuilder = (u: uPlot, seriesIdx: number, idx0: number, idx1: number) => {
    uPlot.orient(
      u,
      seriesIdx,
      (
        series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY,
        xOff, yOff, xDim, yDim, moveTo, lineTo, rect, arc
      ) => {
        const pxRatio = uPlot.pxRatio;
        const scatterInfo = xySeries[seriesIdx - 1];
        let d = u.data[seriesIdx] as unknown as FacetSeries;
        let showLine = scatterInfo.showLine;
        let showPoints = scatterInfo.showPoints === VisibilityMode.Always;
        let strokeWidthCss = scatterInfo.pointStrokeWidth ?? 0;
        let strokeWidthCanvas = strokeWidthCss * pxRatio;

        u.ctx.save();
        u.ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
        u.ctx.clip();

        let pointAlpha = scatterInfo.fillOpacity / 100;
        u.ctx.fillStyle = colorManipulator.alpha(scatterInfo.color.fixed ?? FALLBACK_COLOR, pointAlpha);
        u.ctx.strokeStyle = colorManipulator.alpha(scatterInfo.color.fixed ?? FALLBACK_COLOR, 1);
        u.ctx.lineWidth = strokeWidthCanvas;

        let deg360 = 2 * Math.PI;
        let xKey = scaleX.key!;
        let yKey = scaleY.key!;
        
        // MODIFICAÇÃO (Correção): A config de 'pointSize' deve vir do campo Y.
        const customCfg = (scatterInfo.y.field.config.custom ?? {}) as PanelFieldConfig;
        const pointSize = customCfg.pointSize;
        let maxSize = (pointSize?.max ?? pointSize?.fixed ?? 5) * pxRatio;

        // Otimização de renderização (reaproveitada)
        let filtLft = u.posToVal(-maxSize / 2, xKey);
        let filtRgt = u.posToVal(u.bbox.width / pxRatio + maxSize / 2, xKey);
        let filtBtm = u.posToVal(u.bbox.height / pxRatio + maxSize / 2, yKey);
        let filtTop = u.posToVal(-maxSize / 2, yKey);

        let sizes = opts.disp.size.values(u, seriesIdx);
        let isSquare = scatterInfo.pointShape === PointShape.Square;
        let linePath: Path2D | null = showLine ? new Path2D() : null;

        for (let i = 0; i < d[0].length; i++) {
          let xVal = d[0][i];
          let yVal = d[1][i];

          if (xVal >= filtLft && xVal <= filtRgt && yVal >= filtBtm && yVal <= filtTop) {
            let size = Math.round(sizes[i] * pxRatio);
            let cx = valToPosX(xVal, scaleX, xDim, xOff);
            let cy = valToPosY(yVal, scaleY, yDim, yOff);

            if (showLine) {
              linePath!.lineTo(cx, cy);
            }

            if (showPoints) {
              if (isSquare) {
                let x = Math.round(cx - size / 2);
                let y = Math.round(cy - size / 2);
                if (pointAlpha > 0) {
                  u.ctx.fillRect(x, y, size, size);
                }
                if (strokeWidthCanvas > 0) {
                  u.ctx.strokeRect(x, y, size, size);
                }
              } else {
                u.ctx.beginPath();
                u.ctx.arc(cx, cy, size / 2, 0, deg360);
                if (pointAlpha > 0) {
                  u.ctx.fill();
                }
                if (strokeWidthCanvas > 0) {
                  u.ctx.stroke();
                }
              }
            }
            
            opts.each(
              u,
              seriesIdx,
              i,
              cx - size / 2 - strokeWidthCanvas / 2, // lft
              cy - size / 2 - strokeWidthCanvas / 2, // top
              size + strokeWidthCanvas, // wid
              size + strokeWidthCanvas // hgt
            );
          }
        }

        if (showLine) {
          u.ctx.strokeStyle = scatterInfo.color.fixed!;
          u.ctx.lineWidth = scatterInfo.lineWidth * pxRatio;
          const { lineStyle } = scatterInfo;
          if (lineStyle && lineStyle.fill !== 'solid') {
            if (lineStyle.fill === 'dot') {
              u.ctx.lineCap = 'round';
            }
            u.ctx.setLineDash(lineStyle.dash ?? [10, 10]);
          }
          u.ctx.stroke(linePath!);
        }

        u.ctx.restore();
      }
    );
    return null;
  };
  return drawBubbles;
}

/**
 * Prepara a config do uPlot. Esta é a função "coração" do motor de renderização.
 * Ela é um "fork" do `scatter.ts` nativo, com modificações para
 * ligar-se aos componentes React (Tooltip, Legenda) e suportar
 * a configuração independente dos eixos X e Y.
 */
export const prepConfig = (
  xySeries: XYSeries[],
  theme: GrafanaTheme2,
  // ADIÇÃO: Callback para passar a instância do uPlot para o React
  onChartInstance: (u: uPlot | null) => void,
  // ADIÇÃO: Callback para passar dados do tooltip para o React
  onTooltip: (data: any | null) => void
) => {
  if (xySeries.length === 0) {
    return { builder: null, data: [] };
  }

  // --- Variáveis de estado para o Quadtree/Tooltip ---
  let qt: Quadtree;
  let hRect: Rect | null;
  // MODIFICAÇÃO: Cache da posição do cursor para otimizar a busca no Quadtree
  let lastCx = -1;
  let lastCy = -1;

  // Cria o desenhador de bolhas
  let drawBubbles = drawBubblesFactory(
    {
      disp: {
        size: { values: (u, seriesIdx) => u.data[seriesIdx][2] as any },
        color: { values: (u, seriesIdx) => u.data[seriesIdx][3] as any },
      },
      // ADIÇÃO: 'each' é o 'link' que alimenta o Quadtree
      each: (u, seriesIdx, dataIdx, lft, top, wid, hgt) => {
        qt.add({ x: lft, y: top, w: wid, h: hgt, sidx: seriesIdx, didx: dataIdx });
      },
    },
    xySeries
  );

  const builder = new UPlotConfigBuilder();
  builder.setMode(2); 

  // Configuração do Cursor (reaproveitada, mas com 'dataIdx' otimizado)
  builder.setCursor({
    drag: { setScale: true }, 
    sync: { key: 'xy-cursor' },
    
    // 'dataIdx' usa o Quadtree para "hit detection"
    dataIdx: (u, seriesIdx) => {
      const pxRatio = uPlot.pxRatio;
      let cursorBBoxX = u.cursor.left! * pxRatio;
      let cursorBBoxY = u.cursor.top! * pxRatio;
      let cx = cursorBBoxX + u.bbox.left;
      let cy = cursorBBoxY + u.bbox.top;

      // MODIFICAÇÃO: Usa o cache (lastCx/lastCy) para não re-buscar
      // o Quadtree se o cursor não tiver mudado de pixel.
      if (cx !== lastCx || cy !== lastCy) {
        lastCx = cx;
        lastCy = cy;
        hRect = null;
        let dist = Infinity;

        qt.get(cx, cy, 1, 1, (o) => {
          if (pointWithin(cx, cy, o.x, o.y, o.x + o.w, o.y + o.h)) {
            let ocx = o.x + o.w / 2;
            let ocy = o.y + o.h / 2;
            let dx = ocx - cx;
            let dy = ocy - cy;
            let d = Math.sqrt(dx ** 2 + dy ** 2);

            if (d <= dist) {
              dist = d;
              hRect = o;
            }
          }
        });
      }
      return (hRect && seriesIdx === hRect.sidx && hRect.didx != null) ? hRect.didx : null;
    },
    focus: { prox: 30 },
  });

  // --- Hooks do Ciclo de Vida do uPlot ---

  // MODIFICAÇÃO: 'setCursor' foi simplificado e chama o callback 'onTooltip'
  // para enviar dados ao React, em vez de gerenciar um 'debounce' interno.
  builder.addHook('setCursor', (u) => {
    if (!hRect || u.cursor.left == null || u.cursor.top == null) {
      onTooltip(null);
      return;
    }
    const sidx = hRect.sidx!;
    const didx = hRect.didx!;
    const series = xySeries[sidx - 1];
    type SeriesDataTuple = [number[], number[], number[], string[]];
    const data = (u.data as unknown as [null, ...SeriesDataTuple[]])[sidx];
    
    if (!data) {
      onTooltip(null);
      return;
    }
    const xVal = data[0][didx];
    const yVal = data[1][didx];
    const yField = series.y.field;
    const yDisp = yField.display ? yField.display(yVal) : { text: String(yVal) };

    const tooltipData = {
      seriesName: series.name,
      xValue: String(xVal), 
      yValue: formattedValueToString(yDisp),
      xPos: u.cursor.left,
      yPos: u.cursor.top,
    };
    onTooltip(tooltipData); // Envia dados para o estado do React
  });

  // MODIFICAÇÃO: 'init' chama o callback 'onChartInstance'
  // para passar a instância do uPlot ao React (para a legenda).
  builder.addHook('init', (u, r) => {
    onChartInstance(u); // Envia instância para o estado do React
    u.over.style.overflow = 'hidden';
    qt = new Quadtree(0, 0, u.width, u.height);
  });

  builder.addHook('destroy', (u) => {
    onChartInstance(null);
  });

  // 'drawClear' limpa o Quadtree (reaproveitado)
  builder.addHook('drawClear', (u) => {
    qt.clear();
    u.series.forEach((s, i) => {
      if (i > 0) {
        (s as any)._paths = null;
      }
    });
  });

  // ===================================================================
  // --- INÍCIO DA ARQUITETURA DE EIXOS MODIFICADA ---
  // ===================================================================

  // --- Eixo X (Horizontal) ---
  // MODIFICAÇÃO: Configurado *uma vez*, fora do loop.
  // Lê a configuração do *primeiro* campo X. Overrides funcionam.
  let xField = xySeries[0].x.field;
  let config = xField.config;
  let customConfig = (config.custom ?? {}) as PanelFieldConfig;
  let scaleDistr = customConfig?.scaleDistribution;
  
  builder.addScale({
    scaleKey: 'x',
    orientation: ScaleOrientation.Horizontal,
    direction: ScaleDirection.Right,
    auto: true,
    distribution: scaleDistr?.type,
    log: scaleDistr?.log,
    linearThreshold: scaleDistr?.linearThreshold,
    min: config.min,
    max: config.max, 
    softMin: customConfig?.axisSoftMin,
    softMax: customConfig?.axisSoftMax,
    centeredZero: customConfig?.axisCenteredZero,
    decimals: config.decimals,
  });
  
  // MODIFICAÇÃO: Label do Eixo X é '' por padrão,
  // pois no nosso caso N:1, o eixo X não tem um label único.
  let xAxisLabel = customConfig.axisLabel ?? '';

  builder.addAxis({
    scaleKey: 'x',
    theme,
    placement: customConfig?.axisPlacement === AxisPlacement.Auto ? AxisPlacement.Bottom : customConfig?.axisPlacement,
    show: customConfig?.axisPlacement !== AxisPlacement.Hidden,
    grid: { show: customConfig?.axisGridShow },
    border: { show: customConfig?.axisBorderShow },
    size: customConfig?.axisWidth,
    label: xAxisLabel,
    formatValue: (v, decimals) => formattedValueToString(xField.display!(v, decimals)),
  });

  // --- Adiciona as Séries e Eixos Y ---
  xySeries.forEach((s, si) => {
    const lineColor = s.color.fixed;
    const pointColor = s.color.fixed;
    const seriesLabel = s.name;

    // --- LÓGICA DO EIXO Y (DENTRO DO LOOP) ---
    // MODIFICAÇÃO: A lógica do Eixo Y foi movida para *dentro* do loop.
    // Isso permite que cada série (ou grupos de séries) tenha
    // seu próprio eixo Y e escala, com base na sua 'unit'.
    
    let yField = s.y.field;
    let yIsTime = yField.type === FieldType.time;
    let yFieldConfig = yField.config;
    let yCustomConfig = (yFieldConfig.custom ?? {}) as PanelFieldConfig;
    let yScaleDistr = yCustomConfig?.scaleDistribution;

    // A 'scaleKey' é baseada na 'unit', permitindo múltiplos eixos Y.
    let yScaleKey = yFieldConfig.unit ?? 'y'; 
    
    builder.addScale({
      scaleKey: yScaleKey,
      isTime: yIsTime,
      auto: true,
      orientation: ScaleOrientation.Vertical,
      direction: ScaleDirection.Up,
      distribution: yScaleDistr?.type,
      log: yScaleDistr?.log,
      linearThreshold: yScaleDistr?.linearThreshold,
      min: yFieldConfig.min,
      max: yFieldConfig.max, 
      softMin: yCustomConfig?.axisSoftMin,
      softMax: yCustomConfig?.axisSoftMax,
      centeredZero: yCustomConfig?.axisCenteredZero,
      decimals: yFieldConfig.decimals,
      range: yIsTime ? (u, min, max) => [min, max] : undefined,
    });
    
    // O label do Eixo Y é lido do campo Y
    let yAxisLabel = yCustomConfig.axisLabel ?? (yField.state?.displayName ?? yField.name);
    
    builder.addAxis({
      scaleKey: yScaleKey,
      isTime: yIsTime,
      placement: yCustomConfig?.axisPlacement !== AxisPlacement.Hidden ? yCustomConfig.axisPlacement : AxisPlacement.Hidden,
      show: yCustomConfig?.axisPlacement !== AxisPlacement.Hidden,
      grid: { show: yCustomConfig?.axisGridShow },
      border: { show: yCustomConfig?.axisBorderShow },
      theme,
      label: yAxisLabel,
      formatValue: yIsTime ? undefined : (v, decimals) => formattedValueToString(yField.display!(v, decimals)),
    });

    builder.addSeries({
      name: seriesLabel,
      // 'facets' usa a 'yScaleKey' para linkar a série ao seu eixo Y
      facets: [ { scale: 'x', auto: true }, { scale: yScaleKey, auto: true } ],
      pathBuilder: drawBubbles, 
      theme, 
      scaleKey: yScaleKey,
      lineColor: colorManipulator.alpha(lineColor ?? '#ffff', 1),
      fillColor: colorManipulator.alpha(pointColor ?? '#ffff', 0.5),
      show: !s.x.field.state?.hideFrom?.viz,
      
      value: (u, rawValue, seriesIdx, idx) => {
        if (idx == null) { return ''; }
        const xValues = u.data[seriesIdx][0] as any;
        const yValues = u.data[seriesIdx][1] as any;
        return `X: ${xValues[idx]?.toFixed(2)}, Y: ${yValues[idx]?.toFixed(2)}`;
      },
    });
  });

  // ===================================================================
  // --- FIM DA ARQUITETURA DE EIXOS MODIFICADA ---
  // ===================================================================

  // --- Processamento Final dos Dados (Reaproveitado) ---
  const getGlobalRanges = (xySeries: XYSeries[]) => {
    const ranges = { size: { min: Infinity, max: -Infinity } };
    xySeries.forEach((series) => {
      if (series.size.field != null) {
        let range = ranges.size;
        const vals = series.size.field.values;
        for (let i = 0; i < vals.length; i++) {
          const v = vals[i];
          if (v != null) {
            if (v < range.min) { range.min = v; }
            if (v > range.max) { range.max = v; }
          }
        }
      }
    });
    return ranges;
  };

  const data: FacetedData = [
    null, 
    ...xySeries.map((s, idx) => {
      const { size: sizeRange } = getGlobalRanges([s]);
      let len = s.x.field.values.length;
      let diams: number[];

      if (s.size.field != null) {
        // MODIFICAÇÃO (Correção): 'pointSize' lido do campo Y.
        const customCfg = (s.y.field.config.custom ?? {}) as PanelFieldConfig;
        let { min, max } = customCfg.pointSize ?? {};
        let minPx = (min ?? 1) ** 2; 
        let maxPx = (max ?? 10) ** 2; 
        let pxRange = maxPx - minPx;
        
        let vals = s.size.field.values;
        let minVal = sizeRange.min;
        let maxVal = sizeRange.max;
        let valRange = maxVal - minVal;
        
        diams = Array(len);
        for (let i = 0; i < vals.length; i++) {
          let val = vals[i];
          let valPct = (val - minVal) / valRange;
          let pxArea = minPx + valPct * pxRange;
          diams[i] = pxArea ** 0.5;
        }
      } else {
        diams = Array(len).fill(s.size.fixed ?? 5);
      }
      
      return [
        s.x.field.values,
        s.y.field.values,
        diams,
        Array(len).fill(s.color.fixed!)
      ];
    }),
  ];

  return { builder, data };
};
