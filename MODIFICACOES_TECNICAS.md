# Documentação Técnica - Vericode Custom Chart

## Objetivo
Viabilizar a criação de gráficos de perfil vertical (ou invertidos) onde múltiplas variáveis (Eixo X) são plotadas contra uma referência comum (Eixo Y), corrigindo falhas arquiteturais do plugin nativo que impediam esse caso de uso.

## Análise do Código Original (XY Chart Nativo)

### Arquitetura Identificada
O plugin **XY Chart** nativo do Grafana é construído sobre o motor gráfico **uPlot**. A estrutura de arquivos relevante é:

1.  **XYChartPanel.tsx**: Componente React principal. Gerencia a legenda (`VizLegend`) e o tooltip (`TooltipPlugin2`).
2.  **scatter.ts**: Motor de renderização. Configura o `uPlot`, os eixos e o índice espacial (`Quadtree`).
3.  **utils.ts**: Lógica de processamento de dados (`prepSeries`). Utiliza "Matchers" para transformar DataFrames em séries.

### Bloqueios Encontrados (Por que falha em N:1)

#### 1. Bug do Quadtree (`scatter.ts`)
O motor nativo possui uma otimização de performance que impede o funcionamento do Tooltip em gráficos de linha.
* **Código Original:**
    ```typescript
    if (showPoints) { // <-- Bloqueio
      opts.each(...) // Alimenta o Quadtree
    }
    ```
* **Consequência:** Se o usuário desativa os pontos (comum em perfis verticais), o índice espacial fica vazio. O `uPlot.cursor` não encontra dados, e o Tooltip não é renderizado.

#### 2. Lógica de Filtro da Legenda (`XYChartPanel.tsx`)
A `VizLegend` nativa aplica filtros baseados no `fieldName` do campo Y.
* **Consequência:** No cenário N:1 (ex: Perfil de Poço), todas as séries (Curvas) compartilham o mesmo campo Y (Profundidade). Ao tentar ocultar uma curva, o Grafana tenta ocultar o campo "Profundidade", afetando todas as séries simultaneamente.

#### 3. Configuração de Eixos Acoplada (`prepConfig`)
A lógica original aplicava configurações de `Axis` (Label, Placement) de forma global ou baseada no primeiro campo encontrado.
* **Consequência:** Tentar rotular o Eixo Y via "Overrides" resultava na aplicação do mesmo rótulo ao Eixo X.

## Modificações Implementadas

Para resolver esses problemas sem perder a performance do uPlot, realizamos um **Fork Parcial**, substituindo a camada de UI e refatorando o motor de renderização.

### 1. Camada de UI (Substituição Total)

#### Legenda (`CustomLegend.tsx`)
* **Novo Componente:** Criado do zero em React.
* **Lógica:** Filtra a visibilidade das séries manipulando diretamente a instância do `uPlot` via índice (`u.setSeries(i, { show: boolean })`).
* **Recurso:** Implementa "Clique para Isolar" (clique simples isola a série, segundo clique restaura todas).

#### Tooltip (`CustomTooltip.tsx`)
* **Novo Componente:** Substitui o `TooltipPlugin2` nativo.
* **Renderização:** Renderizado condicionalmente pelo componente pai (`VerticalXYPanel`) com base em um estado local `tooltip`, alimentado por callbacks do motor gráfico.
* **Posicionamento:** Utiliza coordenadas absolutas (`top`, `left`) enviadas pelo `uPlot`.

### 2. Motor de Renderização (`prepConfig.ts`)

Este arquivo é um fork do `scatter.ts` nativo com modificações cirúrgicas.

#### Correção do Tooltip
Movemos a alimentação do `Quadtree` para fora da condicional de visibilidade.
* **Modificação:**
    ```typescript
    // Quadtree agora é alimentado sempre
    opts.each(...) 
    
    if (showPoints) {
       // Apenas o desenho visual dos pontos é condicional
       u.ctx.arc(...)
    }
    ```

#### Desacoplamento dos Eixos
Refatoramos a lógica de criação de eixos (`builder.addAxis`).
* **Lógica Antiga:** Configurava X e Y baseados no primeiro campo.
* **Nova Lógica:**
    * **Eixo X:** Configurado uma vez, baseado no primeiro campo X.
    * **Eixo Y:** Configurado dentro do loop de séries (`forEach`). Cada série gera sua própria escala Y se necessário, permitindo configurações independentes via Overrides.

### 3. Editor de Séries (`ManualSeriesEditor.tsx`)

* **Substituição:** Removemos o editor nativo baseado em "Matchers" (complexo para o usuário final).
* **Novo Editor:** Implementamos um editor visual simples que permite selecionar explicitamente um par **Y-Field** e **X-Field** para cada série.

## Arquitetura de Dados (`VerticalXYPanel.tsx`)

O componente principal atua como o "cérebro" que liga as novas peças:

1.  **Processamento:** Um hook `useMemo` lê a configuração do `ManualSeriesEditor` e os dados brutos.
2.  **Mapeamento:** Gera um array `XYSeries` onde cada item representa um par 1:1 explícito.
3.  **Estado:** Gerencia o estado de `tooltip` e `isolatedSeries` e os repassa para os componentes de UI.
4.  **Sincronia:** Um `useEffect` observa mudanças nos dados para resetar automaticamente filtros de legenda, evitando estados inconsistentes.

## Conclusão

Esta arquitetura mantém a **performance** (renderização Canvas/uPlot) do plugin nativo, mas entrega a **flexibilidade** e **correção de bugs** necessárias para suportar visualizações verticais (N:1) robustas.