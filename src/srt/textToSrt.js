const CARACTERES_POR_BLOCO = 500;
const PALAVRAS_MAX_BLOCO = 100;
const DURACAO_BLOCO = 30;
const INTERVALO_ENTRE_BLOCOS = 10;

function pad(numero, tamanho = 2) {
  return numero.toString().padStart(tamanho, '0');
}

function formatarTempo(segundos) {
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  const segsRestantes = Math.floor(segundos % 60);

  return `${pad(horas)}:${pad(minutos)}:${pad(segsRestantes)},000`;
}

function formatarBlocoSRT(contador, tempoInicio, texto) {
  const tempoFim = tempoInicio + DURACAO_BLOCO;
  return (
    `${contador}\n` +
    `${formatarTempo(tempoInicio)} --> ${formatarTempo(tempoFim)}\n` +
    `${texto.trim()}\n\n`
  );
}

export function converterParaSRT(texto) {
  let srt = '';
  let contador = 1;
  let tempoAcumulado = 0;

  const palavras = texto.trim().split(/\s+/);
  let blocoAtual = '';
  let palavrasNoBloco = 0;

  for (const palavra of palavras) {
    if (
      blocoAtual.length + palavra.length <= CARACTERES_POR_BLOCO &&
      palavrasNoBloco < PALAVRAS_MAX_BLOCO
    ) {
      blocoAtual += palavra + ' ';
      palavrasNoBloco++;
    } else {
      srt += formatarBlocoSRT(contador, tempoAcumulado, blocoAtual);
      contador++;
      tempoAcumulado += DURACAO_BLOCO + INTERVALO_ENTRE_BLOCOS;
      blocoAtual = palavra + ' ';
      palavrasNoBloco = 1;
    }
  }

  if (blocoAtual) {
    srt += formatarBlocoSRT(contador, tempoAcumulado, blocoAtual.trim());
  }

  return srt.trim();
}
