import { PanelPlugin } from '@grafana/data';
import { commonOptionsBuilder } from '@grafana/ui';

import { VerticalXYPanel } from './components/VerticalXYPanel';
import { getScatterFieldConfig } from './config';
import { FieldConfig, defaultFieldConfig, Options, SeriesMapping } from './panelcfg.gen';

import { ManualSeriesEditor } from './components/ManualSeriesEditor';

export const plugin = new PanelPlugin<Options, FieldConfig>(VerticalXYPanel)
  .useFieldConfig(getScatterFieldConfig(defaultFieldConfig))
  .setPanelOptions((builder) => {
    const category = ['XY Chart'];

    builder
      .addRadio({
        path: 'mapping',
        name: 'Series mapping',
        category,
        defaultValue: 'auto',
        settings: {
          options: [
            { value: 'auto', label: 'Auto' },
            { value: 'manual', label: 'Manual' },
          ],
        },
      });

    builder
      .addCustomEditor({
        id: 'manualSeries',
        path: 'manualSeries',
        name: 'Series',
        category,
        editor: ManualSeriesEditor,
        showIf: (c) => c.mapping === SeriesMapping.Manual,
      });

    commonOptionsBuilder.addTooltipOptions(builder, true); 
});
