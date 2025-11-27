# Guia de Instalação e Uso - Vericode Custom Chart

## Visão Geral

O **Vericode Custom Chart** é um plugin de visualização para Grafana, baseado em um fork do plugin oficial **XY Chart**, projetado para suportar gráficos verticais **N:1 (Múltiplos X, Um Y)**.

Neste plugin:
- **Eixo Y (Vertical)**: É usado como referência comum (ex: Tempo ou Profundidade).
- **Eixo X (Horizontal)**: Suporta múltiplas métricas plotadas contra o mesmo Y.

Diferente do plugin nativo (que apresenta falhas neste cenário), este fork possui componentes de **Legenda** e **Tooltip** reescritos para garantir interatividade total mesmo em gráficos de "apenas linhas".

## Estrutura do Plugin

O plugin contém os seguintes arquivos principais modificados:

vericode-custom-chart/
├── src/
│   ├── components/
│   │   ├── CustomLegend.tsx         # Legenda customizada (clique para isolar)
│   │   └── CustomTooltip.tsx        # Tooltip customizado (funciona em linhas)
│   ├── panels/
│   │   ├── VerticalXYPanel.tsx      # "Cérebro" do painel (substitui o nativo)
│   │   ├── ManualSeriesEditor.tsx   # Editor de séries 1:1 simplificado
│   │   └── prepConfig.ts            # Motor de renderização (fork do scatter.ts)
│   ├── module.tsx                   # Ponto de entrada
│   └── plugin.json                  # Metadados
├── dist/                            # Código compilado (o plugin em si)
└── docker-compose.yml               # Ambiente de teste

## Modificações Realizadas

### 1. Interface de Usuário (UI)
* **Legenda:** Substituída a `VizLegend` nativa por `CustomLegend`. Filtra por índice da série, permitindo isolar curvas que compartilham o mesmo eixo Y.
* **Tooltip:** Substituído o `TooltipPlugin` nativo por `CustomTooltip`. Corrige o bug onde o tooltip sumia se os pontos estivessem ocultos.
* **Editor:** Substituído o editor complexo de "Matchers" por um `ManualSeriesEditor` focado em pares X/Y explícitos.

### 2. Motor de Renderização (`prepConfig.ts`)
* **Correção do Quadtree:** O índice de performance agora é alimentado independentemente da visibilidade dos pontos.
* **Eixos Independentes:** A lógica de criação de eixos foi refatorada para permitir que o Eixo Y e o Eixo X recebam configurações de `Label` e `Placement` independentes via Overrides.

## Instalação

### Opção 1: Instalação Manual (On-Premise)

1. **Gere o Build**:
   Na máquina de desenvolvimento, gere a pasta `dist`:
   
   yarn install
   yarn build
   

2. **Copie para o Servidor**:
   Copie a pasta `dist` gerada para o diretório de plugins do seu servidor Grafana:
   
   # Exemplo no Linux
   sudo cp -r dist /var/lib/grafana/plugins/vericode-custom-chart
   

3. **Permita Plugin Não Assinado**:
   Como este é um plugin privado, você deve autorizá-lo no `grafana.ini`:
   
   [plugins]
   allow_loading_unsigned_plugins = vericode-custom-chart
   

4. **Reinicie o Grafana**:
   
   sudo systemctl restart grafana-server
   

### Opção 2: Instalação via Docker

Adicione as seguintes variáveis de ambiente ao seu container Grafana:


environment:
  - GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=vericode-custom-chart
volumes:
  # Mapeia a pasta dist local para a pasta de plugins do container
  - ./dist:/var/lib/grafana/plugins/vericode-custom-chart


## Uso do Plugin

### Criando um Gráfico Vertical (N:1)

1. **Adicione um Painel**: Escolha a visualização **"Vericode Custom Chart"**.
2. **Defina o Modo Manual**: Na barra lateral direita, em "XY Chart > Series Mapping", selecione **Manual**.
3. **Adicione Séries**:
   - Clique em **+ Adicionar Série**.
   - **Y-Field (Vertical)**: Selecione sua variável comum (ex: `TEMPO`).
   - **X-Field (Horizontal)**: Selecione sua métrica (ex: `SENSOR_A`).
   - Repita para quantas métricas quiser (`SENSOR_B`, `SENSOR_C`...).

### Configurando os Eixos (Importante)

Para evitar que o label do Eixo Y ("TEMPO") apareça duplicado no Eixo X (um bug visual comum em N:1), use a aba **Overrides**:

1. **Configure o Eixo Y**:
   - Adicione um override **"Fields by name"**.
   - Selecione o campo Y (`TEMPO`).
   - Adicione a propriedade **Axis > Placement**: `Left`.
   - Adicione a propriedade **Axis > Label**: `Tempo (s)`.

2. **Configure o Eixo X**:
   - Adicione um override **"Fields matching regex"**.
   - Use um regex que capture seus campos de dados (ex: `/SENSOR.*/`).
   - Adicione a propriedade **Axis > Placement**: `Bottom`.
   - Adicione a propriedade **Axis > Label**: Deixe vazio (para limpar).

## Troubleshooting

### "Plugin not signed"
Se o Grafana recusar carregar o plugin, verifique se o ID `vericode-custom-chart` está corretamente listado na configuração `allow_loading_unsigned_plugins` do seu `grafana.ini`.

### Tooltip não aparece
Verifique se você está usando a versão compilada mais recente (`dist`). O tooltip nativo falhava em linhas puras, mas nossa correção (`prepConfig.ts`) resolve isso.

## Suporte

Este plugin é mantido internamente. Para dúvidas sobre o código:
- **Motor Gráfico**: Baseado no `uPlot`.
- **Lógica de Dados**: Veja `src/panels/VerticalXYPanel.tsx`.

## Licença

Apache License 2.0 (Baseado no Grafana XY Chart original).