/**
 * Gerenciador de sons do jogo — gera efeitos sonoros via Web Audio API.
 *
 * Não usa arquivos de áudio externos. Todos os sons são sintetizados
 * em tempo real com osciladores e ganho, resultando em efeitos leves
 * e responsivos sem necessidade de carregar assets.
 *
 * Sons disponíveis:
 * - drop: bola solta (bloop curto)
 * - merge: fusão de bolas (tom ascendente satisfatório)
 * - gameOver: fim de jogo (tom descendente triste)
 * - click: clique de botão (tick suave)
 */

export class SoundManager {
  /** Contexto de áudio compartilhado */
  private ctx: AudioContext | null = null;

  /** Se o som está mutado */
  private _mutado = false;

  /** Getter público para o estado de mudo */
  get mutado(): boolean {
    return this._mutado;
  }

  /**
   * Inicializa o AudioContext.
   * Deve ser chamado após uma interação do usuário (click/touch)
   * para respeitar a política de autoplay dos navegadores.
   */
  inicializar(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    // Resumir contexto se estava suspenso (política de autoplay)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /** Alterna entre mutado e com som */
  toggleMudo(): boolean {
    this._mutado = !this._mutado;
    return this._mutado;
  }

  /**
   * Som de drop — bloop curto e suave.
   * Frequência cai rapidamente de 400Hz para 200Hz.
   */
  tocarDrop(): void {
    if (this._mutado || !this.ctx) return;

    const agora = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, agora);
    osc.frequency.exponentialRampToValueAtTime(200, agora + 0.1);

    gain.gain.setValueAtTime(0.3, agora);
    gain.gain.exponentialRampToValueAtTime(0.01, agora + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(agora);
    osc.stop(agora + 0.15);
  }

  /**
   * Som de merge — tom ascendente satisfatório.
   * Dois osciladores (sine + triangle) criam um timbre rico.
   * Frequência sobe de 300Hz para 800Hz.
   */
  tocarMerge(): void {
    if (this._mutado || !this.ctx) return;

    const agora = this.ctx.currentTime;

    // Oscilador principal — sine
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(300, agora);
    osc1.frequency.exponentialRampToValueAtTime(800, agora + 0.2);
    gain1.gain.setValueAtTime(0.25, agora);
    gain1.gain.exponentialRampToValueAtTime(0.01, agora + 0.3);
    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(agora);
    osc1.stop(agora + 0.3);

    // Oscilador harmônico — triangle (uma oitava acima)
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(600, agora);
    osc2.frequency.exponentialRampToValueAtTime(1200, agora + 0.15);
    gain2.gain.setValueAtTime(0.1, agora);
    gain2.gain.exponentialRampToValueAtTime(0.01, agora + 0.2);
    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(agora);
    osc2.stop(agora + 0.2);
  }

  /**
   * Som de game over — tom descendente melancólico.
   * Três notas curtas caindo (Dó → Lá → Fá).
   */
  tocarGameOver(): void {
    if (this._mutado || !this.ctx) return;

    const agora = this.ctx.currentTime;
    const notas = [523, 440, 349]; // Dó5, Lá4, Fá4

    notas.forEach((freq, i) => {
      const inicio = agora + i * 0.2;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, inicio);

      gain.gain.setValueAtTime(0.25, inicio);
      gain.gain.exponentialRampToValueAtTime(0.01, inicio + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(inicio);
      osc.stop(inicio + 0.25);
    });
  }

  /**
   * Som de clique — tick curto e discreto.
   * Usado para interações de botão.
   */
  tocarClick(): void {
    if (this._mutado || !this.ctx) return;

    const agora = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(600, agora);

    gain.gain.setValueAtTime(0.1, agora);
    gain.gain.exponentialRampToValueAtTime(0.01, agora + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(agora);
    osc.stop(agora + 0.05);
  }

  /**
   * Som de Combo — fanfarra curta de vitória.
   * Arpejo ascendente rápido (Dó→Mi→Sol→Dó alto).
   */
  tocarCombo(): void {
    if (this._mutado || !this.ctx) return;

    const agora = this.ctx.currentTime;
    const notas = [523, 659, 784, 1047]; // Dó5, Mi5, Sol5, Dó6

    notas.forEach((freq, i) => {
      const inicio = agora + i * 0.08;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, inicio);

      gain.gain.setValueAtTime(0.2, inicio);
      gain.gain.exponentialRampToValueAtTime(0.01, inicio + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(inicio);
      osc.stop(inicio + 0.2);
    });
  }

  /**
   * Som de SUPER Combo — fanfarra épica de conquista.
   * Arpejo maior completo com harmônicos + acorde final sustentado.
   */
  tocarSuperCombo(): void {
    if (this._mutado || !this.ctx) return;

    const agora = this.ctx.currentTime;

    // Arpejo ascendente rápido
    const notas = [523, 659, 784, 1047, 1319, 1568]; // Dó→Mi→Sol→Dó→Mi→Sol (2 oitavas)
    notas.forEach((freq, i) => {
      const inicio = agora + i * 0.06;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, inicio);
      gain.gain.setValueAtTime(0.2, inicio);
      gain.gain.exponentialRampToValueAtTime(0.01, inicio + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(inicio);
      osc.stop(inicio + 0.15);
    });

    // Acorde final sustentado (Dó maior) — soa como conquista
    const acordeInicio = agora + notas.length * 0.06;
    const acordeNotas = [1047, 1319, 1568]; // Dó6, Mi6, Sol6
    acordeNotas.forEach((freq) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, acordeInicio);
      gain.gain.setValueAtTime(0.15, acordeInicio);
      gain.gain.exponentialRampToValueAtTime(0.01, acordeInicio + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(acordeInicio);
      osc.stop(acordeInicio + 0.6);
    });
  }

  /**
   * Música de vitória — fanfarra triunfante para entrar no pódio.
   * Melodia ascendente em Dó maior com acorde final sustentado e brilhante.
   * Mais longa e grandiosa que o super combo.
   */
  tocarVitoria(): void {
    if (this._mutado || !this.ctx) return;

    const agora = this.ctx.currentTime;

    // Melodia triunfante: Sol→Dó→Mi→Sol→Dó alto (fanfarra clássica)
    const melodia = [392, 523, 659, 784, 1047];
    melodia.forEach((freq, i) => {
      const inicio = agora + i * 0.15;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, inicio);
      gain.gain.setValueAtTime(0.25, inicio);
      gain.gain.exponentialRampToValueAtTime(0.05, inicio + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(inicio);
      osc.stop(inicio + 0.2);
    });

    // Acorde final majestoso (Dó maior com oitava) — sustentado por 2.0s
    const acordeInicio = agora + melodia.length * 0.15;
    const acordeNotas = [523, 659, 784, 1047]; // Dó5, Mi5, Sol5, Dó6

    acordeNotas.forEach((freq) => {
      // Camada sine — corpo do acorde (mais longo para ressoar)
      const osc1 = this.ctx!.createOscillator();
      const gain1 = this.ctx!.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, acordeInicio);
      gain1.gain.setValueAtTime(0.15, acordeInicio);
      gain1.gain.exponentialRampToValueAtTime(0.01, acordeInicio + 2.0);
      osc1.connect(gain1);
      gain1.connect(this.ctx!.destination);
      osc1.start(acordeInicio);
      osc1.stop(acordeInicio + 2.0);

      // Camada triangle — brilho (acompanha o corpo mais longo)
      const osc2 = this.ctx!.createOscillator();
      const gain2 = this.ctx!.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 2, acordeInicio); // Oitava acima
      gain2.gain.setValueAtTime(0.06, acordeInicio);
      gain2.gain.exponentialRampToValueAtTime(0.01, acordeInicio + 1.4);
      osc2.connect(gain2);
      gain2.connect(this.ctx!.destination);
      osc2.start(acordeInicio);
      osc2.stop(acordeInicio + 1.4);
    });
  }
}

/**
 * Instância global do gerenciador de sons.
 * Compartilhada entre todas as cenas do jogo.
 */
export const soundManager = new SoundManager();
