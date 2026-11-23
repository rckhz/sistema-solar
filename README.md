# 🪐 Sistema Solar 3D

Gire a câmera ao redor do Sol, acompanhe os planetas em suas órbitas e veja um eclipse solar total da perspectiva de quem está na Terra. O simulador roda no navegador e começa na data de hoje.

## O que dá para explorar

- **Do Sol a Plutão.** Clique em um astro na cena ou na lista para aproximar a câmera, acompanhar seu movimento e consultar dados como diâmetro e distância.
- **Tempo sob seu controle.** Pause, desacelere ou acelere a simulação. Clique na data para voltar ao presente.
- **Distâncias em escala.** Ative **Escala real** para ver as distâncias orbitais em proporção. Os astros continuam ampliados para ficarem visíveis.
- **Eclipse solar total.** Arraste a linha do tempo para percorrer as fases, acompanhe a porcentagem do Sol coberta pela Lua ou pule direto para a totalidade.
- **Visualização personalizável.** Alterne as órbitas, os nomes dos astros e o som ambiente pelos botões da interface.

## Como rodar

Você precisa de um navegador com suporte a WebGL e internet para carregar o Three.js e o OrbitControls. Com o Git e o Python 3 instalados, execute:

```sh
git clone https://github.com/rckhz/sistema-solar.git
cd sistema-solar
python -m http.server 8000
```

Abra [http://localhost:8000](http://localhost:8000). Para começar no modo eclipse, use [http://localhost:8000/#eclipse](http://localhost:8000/#eclipse).

## Controles

| Ação | Controle |
| --- | --- |
| Girar a câmera | Arrastar a cena |
| Aproximar ou afastar | Roda do mouse, gesto de pinça ou teclas `+` e `-` |
| Focar em um astro | Selecionar na cena ou na lista de astros |
| Pausar ou retomar o tempo | `Espaço` |
| Voltar à visão geral ou sair do eclipse | `Esc` |

## Como funciona

O projeto usa HTML, CSS e JavaScript, com Three.js r128 e OrbitControls carregados via CDN. As posições planetárias são aproximadas a partir de elementos orbitais com referência em J2000 e da equação de Kepler. [Referência do NASA/JPL](https://ssd.jpl.nasa.gov/planets/approx_pos.html)

| Arquivo | Conteúdo |
| --- | --- |
| [`index.html`](index.html) | Página e controles da interface |
| [`style.css`](style.css) | Estilos e adaptação para telas menores |
| [`app.js`](app.js) | Cena 3D, órbitas, câmera e simulação de eclipse |
| [`textures/`](textures/) | Texturas dos astros, dos anéis de Saturno e do fundo estrelado |

## Créditos

As texturas são do [Solar System Scope](https://www.solarsystemscope.com/textures/) e são distribuídas sob a licença [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
