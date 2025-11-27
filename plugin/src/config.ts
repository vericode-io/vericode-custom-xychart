import {
  FieldColorModeId,
  FieldConfigProperty,
  SetFieldConfigOptionsArgs,
} from '@grafana/data';
import { commonOptionsBuilder } from '@grafana/ui';

import { FieldConfig, XYShowMode, PointShape } from './panelcfg.gen';

export const DEFAULT_POINT_SIZE = 5;

export function getScatterFieldConfig(cfg: FieldConfig): SetFieldConfigOptionsArgs<FieldConfig> {
  return {
    standardOptions: {
      [FieldConfigProperty.Min]: {
        hideFromDefaults: true,
      },
      [FieldConfigProperty.Max]: {
        hideFromDefaults: true,
      },
      [FieldConfigProperty.Unit]: {
        hideFromDefaults: true,
      },
      [FieldConfigProperty.Decimals]: {
        hideFromDefaults: true,
      },
      [FieldConfigProperty.NoValue]: {
        hideFromDefaults: true,
      },
      [FieldConfigProperty.DisplayName]: {
        hideFromDefaults: true,
      },
      [FieldConfigProperty.Color]: {
        settings: {
          byValueSupport: true,
          bySeriesSupport: true,
          preferThresholdsMode: false,
        },
        defaultValue: {
          mode: FieldColorModeId.PaletteClassic,
        },
      },
      [FieldConfigProperty.Links]: {
        settings: {
          showOneClick: true,
        },
      },
      [FieldConfigProperty.Actions]: {
        hideFromDefaults: false,
      },
    },

    useCustomConfig: (builder) => {
      const category = ['XY Chart'];
      builder
        .addRadio({
          path: 'show',
          name: 'Show',
          category,
          defaultValue: cfg.show,
          settings: {
            options: [
              { label: 'Points', value: XYShowMode.Points },
              { label: 'Lines', value: XYShowMode.Lines },
              { label: 'Both', value: XYShowMode.PointsAndLines },
            ],
          },
        })
        // .addGenericEditor(
        //   {
        //     path: 'pointSymbol',
        //     name: 'Point symbol',
        //     defaultValue: defaultFieldConfig.pointSymbol ?? {
        //       mode: 'fixed',
        //       fixed: 'img/icons/marker/circle.svg',
        //     },
        //     settings: {
        //       resourceType: MediaType.Icon,
        //       folderName: ResourceFolderName.Marker,
        //       placeholderText: 'Select a symbol',
        //       placeholderValue: 'img/icons/marker/circle.svg',
        //       showSourceRadio: false,
        //     },
        //     showIf: (c) => c.show !== ScatterShow.Lines,
        //   },
        //   SymbolEditor // ResourceDimensionEditor
        // )
        .addSliderInput({
          path: 'pointSize.fixed',
          name: 'Point size',
          category,
          defaultValue: cfg.pointSize?.fixed ?? DEFAULT_POINT_SIZE,
          settings: {
            min: 1,
            max: 100,
            step: 1,
          },
          showIf: (c) => c.show !== XYShowMode.Lines,
        })
        .addNumberInput({
          path: 'pointSize.min',
          name: 'Min point size',
          category,
          showIf: (c) => c.show !== XYShowMode.Lines,
        })
        .addNumberInput({
          path: 'pointSize.max',
          name: 'Max point size',
          category,
          showIf: (c) => c.show !== XYShowMode.Lines,
        })
        .addRadio({
          path: 'pointShape',
          name: 'Point shape',
          category,
          defaultValue: PointShape.Circle,
          settings: {
            options: [
              { value: PointShape.Circle, label: 'Circle' },
              { value: PointShape.Square, label: 'Square' },
            ],
          },
          showIf: (c) => c.show !== XYShowMode.Lines,
        })
        .addSliderInput({
          path: 'pointStrokeWidth',
          name: 'Point stroke width',
          category,
          defaultValue: 1,
          settings: {
            min: 0,
            max: 10,
          },
          showIf: (c) => c.show !== XYShowMode.Lines,
        })
        .addSliderInput({
          path: 'fillOpacity',
          name: 'Fill opacity',
          category,
          defaultValue: 50,
          settings: {
            min: 0,
            max: 100,
            step: 1,
          },
          showIf: (c) => c.show !== XYShowMode.Lines,
        })
        .addSliderInput({
          path: 'lineWidth',
          name: 'Line width',
          category,
          defaultValue: cfg.lineWidth,
          settings: {
            min: 0,
            max: 10,
            step: 1,
          },
          showIf: (c) => c.show !== XYShowMode.Points,
        });

      commonOptionsBuilder.addAxisConfig(builder, cfg);
      commonOptionsBuilder.addHideFrom(builder);
    },
  };
}
