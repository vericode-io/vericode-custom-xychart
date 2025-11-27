/* eslint-disable @typescript-eslint/no-deprecated */
import React from 'react';
import { StandardEditorProps, Field, FieldType, DataFrame, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Button, Input, Select, ColorPicker, Switch, Field as GrafanaField, useTheme2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { ManualSeriesConfig } from 'panelcfg.gen';

interface Props extends StandardEditorProps<ManualSeriesConfig[]> {}

/**
 * Construir a lista de 'SelectableValue' para os dropdowns.
 */
const buildFieldOptions = (data: DataFrame[], filter?: (f: Field) => boolean): Array<SelectableValue<string>> => {
  const options: Array<SelectableValue<string>> = [];
  data.forEach((frame) => {
    frame.fields.forEach((field) => {
      if (!filter || filter(field)) {
        options.push({ label: field.name, value: field.name });
      }
    });
  });
  return options;
};

export const ManualSeriesEditor: React.FC<Props> = ({ value: seriesList = [], onChange, context }) => {
  const theme = useTheme2();
  const styles = getStyles(theme);

  const data: DataFrame[] = React.useMemo(() => context.data ?? [], [context?.data]);

  const yFieldOptions = React.useMemo(() => buildFieldOptions(data), [data]);
  const xFieldOptions = React.useMemo(
    // Filtra campos X para serem apenas numéricos
    () => buildFieldOptions(data, (f: Field) => f.type === FieldType.number),
    [data]
  );

  // --- Handlers (Baseados em imutabilidade) ---

  const onSeriesChange = (index: number, config: ManualSeriesConfig) => {
    const newList = [...seriesList];
    newList[index] = config;
    onChange(newList);
  };

  const onAddSeries = () => {
    const newList = [...seriesList, { name: 'Series ' + (seriesList.length + 1) }];
    onChange(newList);
  };

  const onRemoveSeries = (index: number) => {
    const newList = seriesList.filter((_, i) => i !== index);
    onChange(newList);
  };

  return (
    <div>
      {seriesList.map((series, index) => (
        <div key={index} className={styles.seriesContainer}>
          <div className={styles.header}>
            <strong>{series.name || `Series ${index + 1}`}</strong>
            <Button
              icon="trash-alt"
              variant="destructive"
              size="sm"
              onClick={() => onRemoveSeries(index)}
              aria-label="Remove series"
            />
          </div>

          <div className={styles.row}>
            <GrafanaField label="Name" className={styles.label}>
              <Input
                value={series.name ?? ''}
                onChange={(e) => onSeriesChange(index, { ...series, name: e.currentTarget.value })}
                placeholder="Nome da Série"
              />
            </GrafanaField>
            <GrafanaField label="Cor">
              <ColorPicker
                color={series.color ?? theme.visualization.palette[index % theme.visualization.palette.length]}
                onChange={(color) => onSeriesChange(index, { ...series, color: color })}
              />
            </GrafanaField>
          </div>

          <div className={styles.row}>
            <GrafanaField label="Y-Field (Vertical)" className={styles.label}>
              <Select
                options={yFieldOptions}
                value={series.yField}
                onChange={(selectable) => onSeriesChange(index, { ...series, yField: selectable.value })}
                width={25}
              />
            </GrafanaField>
          </div>

          <div className={styles.row}>
            <GrafanaField label="X-Field (Horizontal)" className={styles.label}>
              <Select
                options={xFieldOptions}
                value={series.xField}
                onChange={(selectable) => onSeriesChange(index, { ...series, xField: selectable.value })}
                width={25}
              />
            </GrafanaField>
            <GrafanaField label="Limite">
              <Switch
                value={series.isLimit ?? false}
                onChange={(e) => onSeriesChange(index, { ...series, isLimit: e.currentTarget.checked })}
              />
            </GrafanaField>
          </div>
        </div>
      ))}
      <Button icon="plus" onClick={onAddSeries} variant="secondary">
        Adicionar Série
      </Button>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  seriesContainer: css`
    border: 1px solid ${theme.colors.border.strong};
    border-radius: ${theme.shape.borderRadius(1)};
    padding: ${theme.spacing(1)};
    margin-bottom: ${theme.spacing(1)};
  `,
  header: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: ${theme.spacing(1)};
  `,
  row: css`
    display: flex;
    align-items: center;
    gap: ${theme.spacing(2)};
    margin-bottom: ${theme.spacing(0.5)};
  `,
  label: css`
    min-width: 130px;
    font-size: ${theme.typography.size.sm};
  `,
});
