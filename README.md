# Vericode Custom Chart (Vertical XY Panel)

Plugin de visualização para Grafana baseado no plugin **XY Chart** oficial, profundamente modificado para suportar cenários de gráficos **N:1 (Múltiplos X, Um Y)**, comumente usados para visualizações verticais de múltiplas métricas (ex: perfis de poço, logs geológicos).

Este fork resolve limitações arquiteturais do plugin nativo que impediam a interatividade (tooltips e legendas) quando o gráfico é configurado neste modo.

---

## O Problema (Por que este Fork Existe)

O plugin XY Chart nativo do Grafana foi projetado para uma arquitetura **1:N** (Um X, Vários Ys). Ao tentar inverter essa lógica para um gráfico vertical (**N:1**), encontramos dois bloqueios críticos:

1.  **Tooltip Quebrado:** O motor nativo (`scatter.ts`) desativa o índice de busca (`Quadtree`) se os pontos não forem desenhados. Em gráficos de "apenas linhas", o tooltip morre.
2.  **Legenda Inutilizável:** A legenda nativa filtra pelo "Nome do Campo Y". Como no cenário vertical todas as séries compartilham o mesmo Y (ex: "Tempo"), clicar na legenda esconde todas as curvas de uma vez.

**Este plugin corrige estes problemas substituindo a camada de UI e ajustando o motor de renderização.**

## Novas Funcionalidades

| Funcionalidade | Descrição |
| :--- | :--- |
| **Suporte N:1 (Vertical)** | Plote múltiplas métricas (X) contra uma referência comum (Y) sem perder funcionalidades. |
| **Tooltip Customizado** | Novo componente que funciona independente de haver "pontos" ou "linhas". |
| **Legenda Inteligente** | Nova legenda que isola séries pelo índice, permitindo comparar curvas específicas ("Clique para Isolar"). |
| **Editor Simplificado** | Novo editor "Manual" focado em criar pares 1:1 (X/Y) de forma rápida. |
| **Eixos Independentes** | Lógica de eixos reescrita para permitir rótulos independentes para X e Y via Overrides. |

## Instalação Rápida

### Via Docker (Ambiente de Teste)

Clone o repositório e suba o ambiente com o plugin já provisionado:

```bash
# 1. Acessar diretório do plugin
    cd plugin
# 2. Instalar dependências
    npm install
# 3. Build do plugin
    npm run build
# 4. Subir o Grafana
    npm run server
```

Acesse: `http://localhost:3000` (admin/admin).

### Via Manual (On-Premise)

1.  Gere a pasta `dist/` com `yarn build`.
2.  Copie a pasta `dist` para o diretório de plugins do servidor (`/var/lib/grafana/plugins/vericode-custom-chart`).
3.  Permita plugins não assinados no `grafana.ini`:
    ```ini
    [plugins]
    allow_loading_unsigned_plugins = vericode-custom-chart
    ```
4.  Reinicie o Grafana.

## Como Usar

### 1. Criando o Gráfico
1.  Adicione o painel **"Vericode Custom Chart"**.
2.  Na aba lateral, mude **XY Chart > Series Mapping** para **Manual**.
3.  Clique em **+ Adicionar Série** e configure os seus pares:
    * **Y-Field:** Sua referência vertical (ex: `TEMPO`).
    * **X-Field:** Sua métrica (ex: `SENSOR_A`).

### 2. Configurando Eixos (Dica de Ouro)
Para que os rótulos fiquem perfeitos (Y à esquerda, X embaixo, sem duplicatas), use a aba **Overrides**:

* **Eixo Y (Vertical):** Crie um override por **Nome** (`Fields by name: TEMPO`). Defina `Placement: Left` e o Label desejado.
* **Eixo X (Horizontal):** Crie um override por **Regex** (`Fields matching regex: /SENSOR.*/`). Defina `Placement: Bottom` e deixe o Label vazio.

---

## Documentação Detalhada

Para detalhes profundos sobre a implementação e análise de código, consulte os ficheiros na raiz do projeto:

* [Instalação e Uso Detalhado](INSTALACAO_E_USO.md)
* [Detalhes Técnicos e Arquitetura](MODIFICACOES_TECNICAS.md)
* [Análise do Plugin Nativo](xychart_analysis.md)

---
**Licença**: Apache License 2.0 (Baseado no Grafana XY Chart)
        
