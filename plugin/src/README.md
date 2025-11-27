# Gráfico XY Vertical (N:1) Customizado

Plugin de visualização para Grafana baseado no plugin **XY Chart** oficial, modificado para suportar corretamente gráficos **N:1 (Múltiplos X, Um Y)**, como gráficos verticais.

Este plugin corrige bugs críticos de arquitetura do plugin nativo que impediam a visualização de dados N:1, especificamente a falha do Tooltip e o filtro da legenda.

## O Problema (Por que este Fork Existe)

Nossa análise no código-fonte do XY Chart nativo identificou dois problemas de arquitetura que tornam o cenário N:1 (Múltiplos X, Um Y) inutilizável:

* **Bug do Tooltip (em `scatter.ts`):** O motor nativo só alimenta seu índice de performance (o `Quadtree`) se a opção `"Show: Points"` estiver ativa. Em gráficos de "Apenas Linhas" (nosso caso de uso), o `Quadtree` fica vazio, quebrando totalmente o `Tooltip`.
* **Bug da Legenda (em `XYChartPanel.tsx`):** A legenda nativa (`VizLegend`) aplica seus filtros com base no **nome do campo Y** (`yField.name`). No nosso cenário N:1, todas as séries (ex: 'S_RS', 'SE_SP') compartilham o *mesmo* campo Y ('TEMPO'). Clicar para esconder uma série faz com que o Grafana tente esconder o campo 'TEMPO', o que falha ou esconde *todas* as séries de uma vez.

Este fork corrige os dois problemas substituindo a camada de UI (Legenda e Tooltip) por componentes customizados.

## Funcionalidades

### Funcionalidades do XY Chart Original (Reaproveitadas)

Nós mantivemos o "coração" de alta performance do plugin nativo:
- Renderização via `uPlot` e `<canvas>`.
- Otimização de "hover" via `Quadtree` (que nós corrigimos).
- Integração total com a aba **"Overrides"** do Grafana para estilização de campos (linhas, pontos, eixos, etc.).

### Novas Funcionalidades (O que nós adicionamos)

#### 1. Editor de Séries 1:1 (Manual)
* **Substituição:** O editor nativo complexo (baseado em "Matchers") foi removido.
* **Adição:** Um `ManualSeriesEditor` simples que permite configurar pares **1:1 (Um X, Um Y)**, ideal para o nosso cenário N:1.

#### 2. Tooltip Customizado (Funcional)
* **Substituição:** O `TooltipPlugin2` nativo (que estava quebrado) foi removido.
* **Adição:** Um `CustomTooltip` 100% customizado, alimentado diretamente pelo nosso motor `prepConfig` modificado.
* **Correção:** Nosso `prepConfig.ts` alimenta o `Quadtree` **mesmo no modo "só linhas"**, fazendo o tooltip funcionar perfeitamente.

#### 3. Legenda Customizada com "Clique para Isolar"
* **Substituição:** A `VizLegend` nativa (que filtrava pelo campo Y errado) foi removida.
* **Adição:** Uma `CustomLegend` horizontal e "scrollável".
* **Funcionalidade:** Aplica o filtro com base no **índice da série** (0, 1, 2...), não no nome do campo. Isso permite **clicar para isolar** uma série corretamente. O isolamento é resetado automaticamente se os dados ou as opções do painel mudarem.

#### 4. Eixos X e Y Independentes
* **Modificação:** O `prepConfig.ts` foi refatorado para que a configuração do Eixo X e do Eixo Y seja lida de seus respectivos campos.
* **Correção:** Resolve o bug onde um "Override" de "Axis" (ex: `Label: 'TEMPO'`) era aplicado tanto no eixo X quanto no Y.

## Instalação

### Método 1: Docker (Provisionamento)

Este é o método recomendado para testar (e o que o Grafana.com usa para validar).

1.  Clone este repositório.
2.  Rode o build do plugin:
    ```bash
    yarn build
    ```
3.  Inicie o Docker Compose:
    ```bash
    docker-compose up
    ```
4.  Acesse: `http://localhost:3000` (admin/admin). O plugin e um dashboard de teste (`dashboard.json`) já estarão provisionados.

(Para este método funcionar, os arquivos `docker-compose.yml`, `provisioning/` e `src/dashboards/dashboard.json` são necessários).

### Método 2: Instalação Manual

1.  Copie a pasta `dist/` (gerada após o `yarn build`) para o diretório de plugins do seu Grafana.
    ```bash
    # Exemplo no Linux
    sudo cp -r dist /var/lib/grafana/plugins/seu-plugin-id
    ```

2.  Configure o Grafana para permitir plugins não assinados. Edite seu `grafana.ini`:
    ```ini
    [plugins]
    allow_unsigned_plugins = seu-plugin-id # <-- Use o ID do seu plugin.json
    ```

3.  Reinicie o servidor Grafana.

## Uso

### Criando um Painel Vertical

1.  Crie ou edite um dashboard.
2.  Adicione um novo painel e selecione o **"Vertical XY Chart"** (ou o nome do seu plugin).
3.  Na aba "Panel" (editor da direita), mude o **"Mapeamento de Série"** para **"Manual"**.
4.  Você verá o editor customizado.
5.  Clique em **"Adicionar Série"**.
6.  Configure seu par 1:1:
    * **Y-Field (Vertical):** Selecione seu campo Y (ex: "TEMPO").
    * **X-Field (Horizontal):** Selecione seu campo X (ex: "S_RS").
7.  Repita os passos 5 e 6 para todos os campos X (ex: "TEMPO" vs "SE_SP", "TEMPO" vs "NE_BA", etc.).

### Configurando os Eixos (Importante)

Para configurar os eixos X e Y de forma independente:

1.  Vá para a aba **"Overrides"**.
2.  **Override do Eixo Y:**
    * Adicione um override para "Fields by name".
    * Selecione seu campo Y (ex: "TEMPO").
    * Adicione a propriedade "Axis" e configure `Placement: Left` e `Label: TEMPO`.
3.  **Override do Eixo X:**
    * Adicione um override para "Fields matching regex".
    * Use um regex que pegue seus campos X (ex: `/_/`).
    * Adicione a propriedade "Axis" e configure `Placement: Auto` (ou `Bottom`) e `Label: ''` (vazio).

## Arquitetura Técnica

### O que foi modificado

* **`prepConfig.ts`**: Este é o nosso "fork" do `scatter.ts` nativo.
    * **Correção do Tooltip:** Movemos a chamada do `Quadtree.add()` para fora do `if (showPoints)`, fazendo o tooltip funcionar no modo "só linhas".
    * **Eixos Independentes:** Movemos a lógica de `addAxis('y')` e `addScale('y')` para dentro do *loop* `forEach` da série, permitindo eixos Y independentes.
    * **Callbacks:** A função agora aceita `onChartInstance` e `onTooltip` para "linkar" o uPlot aos estados do React no `VerticalXYPanel`.
* **`VerticalXYPanel.tsx`**: É o "cérebro" do plugin.
    * Substitui o `prepSeries` nativo por um `useMemo` que usa nosso `ManualSeriesEditor`.
    * Gerencia os estados `isolatedSeriesIndex` (para a legenda) e `tooltip` (para o tooltip).
    * Renderiza `CustomLegend` e `CustomTooltip`.
* **`CustomLegend.tsx` / `CustomTooltip.tsx` / `ManualSeriesEditor.tsx`**: Componentes React 100% novos que substituem os nativos.

## Comparação

| Aspecto | XY Chart Nativo | Nosso Fork (Vertical XY) |
|---|---|---|
| **Base** | `XYChart` | `XYChart` (Motor) |
| **Cenário N:1 ("Vertical")** | **Quebrado** | **Funcional** |
| **Tooltip (Modo "Linhas")** | **Quebrado** (Bug do Quadtree) | **Corrigido** (via `prepConfig.ts`) |
| **Legenda** | `VizLegend` Nativa (Filtra pelo campo Y errado) | `CustomLegend` (Filtra pelo índice da série) |
| **Editor de Séries** | Baseado em "Matchers" | Simples, 1:1 (X/Y) |
| **Eixos X/Y** | Configuração unificada (bugada) | Configuração **independente** via Overrides |

## Licença

Apache License 2.0 (mesma do Grafana)