# 🎮 Merge & Grow

Jogo estilo **Suika (Watermelon Game)** feito com **Phaser 3** + **TypeScript**.

Junte bolas de mesmo peso para criar bolas maiores! De **1Kg** até **1 Tonelada**.

## 🕹️ Jogar

**[Clique aqui para jogar no navegador](https://felipefetec.github.io/merge-grow/)**

## 📖 Como Jogar

- Clique ou toque na tela para soltar uma bola
- Quando duas bolas de **mesmo peso** se encostam, elas se fundem em uma bola maior (o dobro do peso)
- O jogo acaba quando uma bola ultrapassa a linha de perigo no topo
- Tente fazer a maior pontuação possível e entre no **Top 3** do ranking!

## ⚡ Recursos

- **11 níveis de bolas**: 1Kg → 2Kg → 4Kg → ... → 512Kg → 1 Tonelada
- **Física realista** com Matter.js — peso influencia o comportamento das colisões
- **Sistema de combos**: junte 3+ bolas rapidamente para Combo, 5+ para Super Combo
- **Efeitos sonoros** sintetizados em tempo real (Web Audio API — sem arquivos de áudio)
- **Confetes e serpentinas** em combos e ao entrar no pódio
- **Ranking local** com medalhas 🥇🥈🥉 para os 3 primeiros
- **Responsivo** — funciona em desktop, tablet e celular

## 🛠️ Tecnologias

- [Phaser 3](https://phaser.io/) — motor de jogos 2D
- [Matter.js](https://brm.io/matter-js/) — engine de física
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) — bundler
- [GitHub Pages](https://pages.github.com/) — hospedagem

## 💻 Rodar Localmente

```bash
git clone https://github.com/felipefetec/merge-grow.git
cd merge-grow
npm install
npm run dev
```

O jogo abre automaticamente em `http://localhost:3000`.

## 📦 Build de Produção

```bash
npm run build
npm run preview
```
