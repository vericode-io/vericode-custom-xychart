import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  PanelProps,
  Field,
  DataFrame,
  FieldType,
  FALLBACK_COLOR,
  GrafanaTheme2,
} from '@grafana/data';
import { VisibilityMode } from '@grafana/schema';
import { UPlotChart, useTheme2 } from '@grafana/ui';
import {
  Options,
  FieldConfig as PanelFieldConfig,
  PointShape,
  XYShowMode,
  SeriesMapping,
  XYSeries,
  TooltipData,
} from '../panelcfg.gen';
// MODIFICAÇÃO: Importa o nosso 'prepConfig' (fork do 'scatter.ts')
import { prepConfig } from '../scatter';
import uPlot from 'uplot';
// ADIÇÃO: Importa nossos componentes customizados de UI
import { CustomLegend } from './CustomLegend';
import { CustomTooltip } from './CustomTooltip';

interface Props extends PanelProps<Options> {}

// --- Funções Auxiliares (Helpers) ---

/**
 * Helper (reaproveitado) para ler a config customizada de um campo.
 */
const getCustomConfig = (field: Field): PanelFieldConfig => {
  return (field.config.custom ?? {}) as PanelFieldConfig;
};

/**
 * ADIÇÃO: Cria um 'Map' de campos para otimizar a busca (O(1))
 * no Modo Manual.
 */
const buildFieldMap = (data: DataFrame[]): Map<string, Field> => {
  const map = new Map<string, Field>();
  if (!data) {
    return map;
  }
  for (const frame of data) {
    for (const field of frame.fields) {
      map.set(field.name, field);
    }
  }
  return map;
};

/**
 * Helper para determinar a cor da série.
 */
const getSeriesColor = (
  theme: GrafanaTheme2,
  manualColor?: string,
  index?: number
): string => {
  if (manualColor) {
    return theme.visualization.getColorByName(manualColor);
  }
  const colorName = theme.visualization.palette[index ?? 0 % theme.visualization.palette.length];
  return theme.visualization.getColorByName(colorName);
};

/**
 * ADIÇÃO: Função centralizada para construir nosso objeto XYSeries
 * e evitar duplicação de código entre os modos Auto e Manual.
 */
const mapFieldsToXYSeries = (
  xField: Field,
  yField: Field,
  theme: GrafanaTheme2,
  config: {
    name: string;
    color?: string;
    index: number;
    isLimit?: boolean;
  }
): XYSeries => {
  // Lê a config (dos Overrides) do campo X
  const customCfg = getCustomConfig(xField);
  const finalColor = getSeriesColor(theme, config.color, config.index);

  const show = customCfg.show ?? XYShowMode.Points;
  const showLine = show === XYShowMode.Lines || show === XYShowMode.PointsAndLines;
  const showPoints =
    show === XYShowMode.Points || show === XYShowMode.PointsAndLines
      ? VisibilityMode.Always
      : VisibilityMode.Never;

  return {
    name: config.name,
    x: { field: xField },
    y: { field: yField },
    color: { fixed: finalColor },
    isLimit: config.isLimit ?? false,
    size: {
      fixed: customCfg.pointSize?.fixed ?? 5,
      min: customCfg.pointSize?.min,
      max: customCfg.pointSize?.max,
    },
    showLine: showLine,
    lineWidth: customCfg.lineWidth ?? 1,
    lineStyle: customCfg.lineStyle,
    showPoints: showPoints,
    pointShape: customCfg.pointShape ?? PointShape.Circle,
    pointStrokeWidth: customCfg.pointStrokeWidth ?? 0,
    fillOpacity: customCfg.fillOpacity ?? 50,
  };
};

// --- Componente Principal (O "Cérebro" do Plugin) ---

export const VerticalXYPanel: React.FC<Props> = ({ options, data, width, height }) => {
  const theme = useTheme2();
  
  // ADIÇÃO: 'Ref' para manter a instância do uPlot (necessária para a legenda).
  const uPlotInstance = useRef<uPlot | null>(null);
  // ADIÇÃO: Estado para controlar quais séries estão ocultas pela legenda.
  const [hiddenSeriesIndexes, setHiddenSeriesIndexes] = useState<number[]>([]);
  // ADIÇÃO: Estado para guardar os dados do 'CustomTooltip'.
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  /**
   * MODIFICAÇÃO CORE:
   * Este 'useMemo' é a lógica central do nosso plugin.
   * Ele substitui o 'prepSeries' nativo, lendo as opções (do nosso editor)
   * e os dados para criar o array 'xySeries' no formato 1:1.
   */
  const xySeries = useMemo((): XYSeries[] => {
    if (!data || !data.series || data.series.length === 0) {
      return [];
    }

    // Lógica do Modo Manual (lê 'options.manualSeries')
    if (options.mapping === SeriesMapping.Manual) {
      const seriesList = options.manualSeries ?? [];
      const fieldMap = buildFieldMap(data.series);

      return seriesList
        .map((seriesConfig, index): XYSeries | undefined => {
          if (!seriesConfig.yField || !seriesConfig.xField) {
            return undefined;
          }
          const yField = fieldMap.get(seriesConfig.yField);
          const xField = fieldMap.get(seriesConfig.xField);

          if (!yField || !xField) {
            return undefined;
          }

          const seriesName = seriesConfig.name ?? xField.name;

          return mapFieldsToXYSeries(xField, yField, theme, {
            name: seriesName,
            color: seriesConfig.color,
            index: index,
            isLimit: seriesConfig.isLimit,
          });
        })
        .filter((series): series is XYSeries => series !== undefined);
    }

    // Lógica do Modo Auto (Y = 1º campo, X = outros campos numéricos)
    const frame = data.series[0];
    if (!frame || frame.fields.length < 2) {
      return [];
    }
    const yField = frame.fields[0];
    const xFields = frame.fields.filter(
      (field, index) => index > 0 && field.type === FieldType.number
    );

    return xFields.map((xField, index): XYSeries => {
      const seriesName = xField.state?.displayName ?? xField.name;

      return mapFieldsToXYSeries(xField, yField, theme, {
        name: seriesName,
        index: index,
        isLimit: false,
      });
    });
  }, [options.mapping, options.manualSeries, data, theme]);

  // Reseta estados quando os dados ou opções mudam
  useEffect(() => {
    setHiddenSeriesIndexes([])
  }, [xySeries]);
  
  useEffect(() => {
     const u = uPlotInstance.current;
     if (!u) { return; }
 
     // As séries de dados começam no índice 1 do uPlot
     for (let i = 0; i < xySeries.length; i++) {
         const uPlotIndex = i + 1;
         const isHidden = hiddenSeriesIndexes.includes(i);
         
         u.setSeries(uPlotIndex, { show: !isHidden });
     }
   }, [hiddenSeriesIndexes, xySeries]);

  /**
   * MODIFICAÇÃO:
   * Chama o nosso 'prepConfig' (fork do 'scatter.ts') e passa
   * os callbacks (onChartInstance, setTooltip) para "linkar"
   * o motor uPlot de volta aos estados do React.
   */
  const { builder, data: plotData } = useMemo(() => {
    if (xySeries.length === 0) {
      return { builder: null, data: [] };
    }

    return prepConfig(
      xySeries,
      theme,
      (u: uPlot | null) => {
        uPlotInstance.current = u; // Salva a instância do uPlot
      },
      setTooltip // Passa o 'setter' do estado do tooltip
    );
  }, [xySeries, theme, setTooltip]);

  /**
   * ADIÇÃO:
   * Handler para o clique na 'CustomLegend'.
   * Controla o uPlot (show/hide) com base no clique.
   */
  const onSeriesClick = (seriesIndex: number, event: React.MouseEvent) => {
    const u = uPlotInstance.current;
    if (!u) {
      return;
    }

    const clickedSeries = xySeries[seriesIndex];
    if (clickedSeries?.isLimit) {
      return;
    }

    const isCtrlClick = event.ctrlKey || event.metaKey;
    const allIndexes = xySeries.map((_, i) => i);

    if (isCtrlClick) {
        // --- CTRL + CLICK: Toggle Aditivo ---
        // Adiciona ou remove APENAS a série clicada da lista de escondidos,
        // respeitando o estado atual das outras.
        
        setHiddenSeriesIndexes(prev => {
            if (prev.includes(seriesIndex)) {
                return prev.filter(i => i !== seriesIndex);
            } else {
                return [...prev, seriesIndex];
            }
        });

    } else {
        // --- CLIQUE NORMAL: Isolamento Exclusivo ---
        
        // Isso acontece se a lista de escondidos tem tamanho (Total - 1)
        // E a série clicada NÃO está na lista.
        const isAlreadyIsolated = hiddenSeriesIndexes.length === (allIndexes.length - 1) && 
                                  !hiddenSeriesIndexes.includes(seriesIndex);

        if (isAlreadyIsolated) {
            setHiddenSeriesIndexes([]);
        } else {
            const others = allIndexes.filter(i => i !== seriesIndex);
            setHiddenSeriesIndexes(others);
        }
    }
  };

  /**
   * ADIÇÃO:
   * Prepara os dados (itens) para o nosso componente 'CustomLegend'.
   */
  const legendItems = useMemo(() => {
    return xySeries
      .map((s, index) => {
        return {
          name: s.name,
          color: s.color.fixed ?? FALLBACK_COLOR,
          isLimit: s.isLimit ?? false,
          originalIndex: index,
        };
      })
      .filter((item) => !item.isLimit);
  }, [xySeries]);

  // --- Renderização ---

  if (!builder || !plotData || plotData.length === 0) {
    return (
      <div className="panel-empty">
        <p>No data found.</p>
        {options.mapping === SeriesMapping.Manual && (
          <p>
            <i>Modo Manual: Clique em &quot;Adicionar Série&quot; e selecione os campos Y e X.</i>
          </p>
        )}
        {options.mapping === SeriesMapping.Auto && (
          <p>
            <i>Modo Auto: Y = 1ª coluna, X = outras colunas numéricas.</i>
          </p>
        )}
      </div>
    );
  }

  const LEGEND_HEIGHT = 40;
  const chartHeight = height - LEGEND_HEIGHT;

  return (
    <div style={{ width, height, position: 'relative' }}>
      <UPlotChart
        config={builder}
        data={plotData}
        width={width}
        height={chartHeight}
      />

      {/* ADIÇÃO: Renderiza nosso tooltip customizado (baseado no estado) */}
      {tooltip && <CustomTooltip data={tooltip} />}

      {/* ADIÇÃO: Renderiza nossa legenda customizada */}
      <div style={{ height: LEGEND_HEIGHT, overflow: 'auto' }}>
        <CustomLegend
          series={legendItems}
          onSeriesClick={onSeriesClick}
          hiddenIndexes={hiddenSeriesIndexes}
        />
      </div>
    </div>
  );
};
