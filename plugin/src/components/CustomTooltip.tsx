/* eslint-disable @typescript-eslint/no-deprecated */
import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';
import { TooltipData } from 'panelcfg.gen';

/**
 * ADIÇÃO: Este é o nosso componente de Tooltip customizado.
 * Ele substitui o 'TooltipPlugin2' nativo.
 */
export const CustomTooltip: React.FC<{ data: TooltipData }> = ({ data }) => {
  const theme = useTheme2();
  const styles = getStyles(theme);

  // MODIFICAÇÃO (Otimização):
  // Separa os estilos dinâmicos (left/top) dos estáticos (abaixo).
  // 'style' inline é atualizado em cada render, 'className' (Emotion) não.
  // Adiciona 10px de offset para o cursor.
  const dynamicStyle = {
    left: data.xPos + 10,
    top: data.yPos + 10,
  };

  return (
    <div className={styles.wrapper} style={dynamicStyle}>
      <div className={styles.header}>
        {data.seriesName}
      </div>
      <div className={styles.row}>
        <span className={styles.label}>X:</span> {data.xValue}
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Y:</span> {data.yValue}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    position: absolute;
    background: ${theme.colors.background.secondary};
    border: 1px solid ${theme.colors.border.strong};
    border-radius: ${theme.shape.borderRadius()};
    padding: ${theme.spacing(1)};
    z-index: 100;
    font-size: ${theme.typography.size.sm};
    pointer-events: none;
  `,
  header: css`
    font-weight: bold;
    color: ${theme.colors.text.primary};
    margin-bottom: ${theme.spacing(0.5)};
  `,
  row: css`
    color: ${theme.colors.text.primary};
  `,
  label: css`
    color: ${theme.colors.text.secondary};
    margin-right: ${theme.spacing(0.5)};
  `,
});
