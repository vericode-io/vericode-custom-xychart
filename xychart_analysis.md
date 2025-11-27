# Análise Técnica do Plugin Nativo (Grafana XY Chart)

## Objetivo da Análise
Avaliar a viabilidade de utilizar o plugin nativo **XY Chart** para renderizar gráficos de perfil vertical (Cenário **N:1**: Múltiplos X contra Um Y) e identificar os pontos de falha que exigiram a criação do fork **Vericode Custom Chart**.

## Estrutura de Arquivos (Plugin Nativo)

Baseado no código-fonte original (v10.x):

### Arquivos Críticos Analisados:
1.  **scatter.ts** - Motor de renderização (uPlot). **PONTO DE FALHA CRÍTICO (Tooltip).**
2.  **XYChartPanel.tsx** - Componente principal e UI. **PONTO DE FALHA CRÍTICO (Legenda).**
3.  **utils.ts** - Processamento de dados (`prepSeries`). Projetado para arquitetura 1:N.
4.  **SeriesEditor.tsx** - Editor de configuração. Baseado em "Matchers" complexos.
5.  **config.ts** - Definições de estilo (Overrides). **REAPROVEITADO.**

## Pontos de Bloqueio Identificados

Durante a tentativa de adaptação para o cenário N:1 (Gráfico Vertical), identificamos três limitações estruturais no código nativo que impedem o funcionamento correto.

### 1. Bug de Renderização do Tooltip (`scatter.ts`)

O motor de renderização possui uma otimização que desativa a indexação espacial quando os pontos não são desenhados.

**Código Nativo (`drawBubblesFactory`):**
```typescript
// scatter.ts
if (showPoints) {
  // ... desenha o ponto ...
  
  // Apenas alimenta o índice de busca (Quadtree) se showPoints for true
  opts.each(u, seriesIdx, i, cx, cy, ...); 
}