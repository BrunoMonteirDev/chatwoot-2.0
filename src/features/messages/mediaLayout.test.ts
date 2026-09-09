import { describe, expect, it } from 'vitest';
import { fittedMediaDimensions, mediaFrame } from './mediaLayout';

describe('media layout reservation', () => {
  it('reserva landscape 1920x1080 dentro dos limites desktop', () => {
    expect(fittedMediaDimensions({ width: 1920, height: 1080 }, { width: 1440, height: 900, mobile: false })).toEqual({ width: 460, height: 259 });
  });

  it('reserva portrait 1080x1920 respeitando a altura desktop', () => {
    expect(fittedMediaDimensions({ width: 1080, height: 1920 }, { width: 1440, height: 900, mobile: false })).toEqual({ width: 326, height: 580 });
  });

  it('não amplia imagem pequena', () => {
    expect(fittedMediaDimensions({ width: 250, height: 180 }, { width: 1440, height: 900, mobile: false })).toEqual({ width: 250, height: 180 });
  });

  it('aplica 90vw e 62vh no mobile preservando proporção', () => {
    expect(fittedMediaDimensions({ width: 1920, height: 1080 }, { width: 390, height: 844, mobile: true })).toEqual({ width: 351, height: 197 });
    expect(fittedMediaDimensions({ width: 1080, height: 1920 }, { width: 390, height: 844, mobile: true })).toEqual({ width: 294, height: 523 });
  });

  it('usa fallback estável 4:3 para imagem e 16:9 para vídeo legado', () => {
    expect(mediaFrame({ type: 'image', width: undefined, height: undefined }, { width: 390, height: 844, mobile: true })).toMatchObject({ width: 320, height: 240, aspectRatio: '320 / 240', source: 'fallback' });
    expect(mediaFrame({ type: 'video', width: undefined, height: undefined }, { width: 390, height: 844, mobile: true })).toMatchObject({ width: 320, height: 180, aspectRatio: '320 / 180', source: 'fallback' });
  });
});
