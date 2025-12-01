/* eslint-disable @typescript-eslint/no-deprecated */
import React from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { useTheme2 } from '@grafana/ui';

interface LegendItemProps {
  name: string;
  color: string;
  originalIndex: number; // O índice original do 'xySeries'
}

interface Props {
  series: LegendItemProps[];
  onSeriesClick: (seriesIndex: number, event: React.MouseEvent) => void; // Callback para o 'VerticalXYPanel'
  isolatedIndex?: number | null; // Estado vindo do 'VerticalXYPanel'
  hiddenIndexes?: number[]; // Índices dos itens que estão ocultos
}

/**
 * ADIÇÃO: Este é o nosso componente de Legenda customizado.
 * Ele substitui o 'VizLegend' nativo para permitir a funcionalidade
 * de "clique para isolar" (show/hide).
 */
export const CustomLegend: React.FC<Props> = ({ 
  series, 
  onSeriesClick, 
  isolatedIndex, 
  hiddenIndexes = []
}) => {
  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <div className={styles.wrapper}>
      {series.map((item, index) => {
        const isHidden = hiddenIndexes.includes(item.originalIndex);

        return (
          <div
            key={item.originalIndex}
            className={styles.itemWrapper}
            onClick={(e) => onSeriesClick(item.originalIndex, e)}
            style={{ opacity: isHidden ? 0.3 : 1, transition: 'opacity 0.3s' }}
          >
            <div
              className={styles.seriesIcon}
              style={{ backgroundColor: item.color }}
            />
            <span 
              className={styles.label}
              style={{ color: theme.colors.text.secondary }}
            >
              {item.name}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    display: flex;
    padding: ${theme.spacing(1)};
    gap: ${theme.spacing(2)};
    flex-wrap: nowrap;
    justify-content: flex-start;
    overflow-x: auto;
    overflow-y: hidden;
    height: 100%;
  `,
  itemWrapper: css`
    cursor: pointer;
    display: flex;
    align-items: center;
    transition: opacity 0.2s ease-in-out;
    pointer-events: auto;
    flex-shrink: 0;
  `,
  seriesIcon: css`
    width: 14px;
    height: 14px;
    margin-right: ${theme.spacing(0.5)};
    border-radius: ${theme.shape.borderRadius(1)};
    flex-shrink: 0;
  `,
  label: css`
    font-size: ${theme.typography.size.sm};
    color: ${theme.colors.text.secondary};
    white-space: nowrap;
    &:hover {
      color: ${theme.colors.text.primary};
    }
  `,
});
