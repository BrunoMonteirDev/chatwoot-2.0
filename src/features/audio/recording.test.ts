// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { extensionForRecordingMimeType, finiteAudioDuration, recordingFile, recordingMimeType, releaseRecordingResources } from './recording';

describe('audio recording helpers', () => {
  it('prioriza OGG/Opus e preserva o formato suportado pelo navegador', () => {
    expect(recordingMimeType((type) => type === 'audio/webm;codecs=opus')).toBe('audio/webm;codecs=opus');
    expect(recordingMimeType((type) => type === 'audio/mp4')).toBe('audio/mp4');
    expect(extensionForRecordingMimeType('audio/ogg; codecs=opus')).toBe('ogg');
    expect(extensionForRecordingMimeType('audio/webm;codecs=opus')).toBe('webm');
    expect(extensionForRecordingMimeType('audio/mp4')).toBe('m4a');
  });

  it('cria uma única revisão com MIME e extensão corretos', () => {
    const file = recordingFile([new Blob(['audio'])], 'audio/mp4', 123);
    expect(file).toMatchObject({ name: 'audio-123.m4a', type: 'audio/mp4' });
  });

  it('aceita apenas durações finitas e libera stream e ObjectURL ao cancelar', () => {
    expect(finiteAudioDuration(Number.NaN)).toBeNull();
    expect(finiteAudioDuration(Number.POSITIVE_INFINITY)).toBeNull();
    expect(finiteAudioDuration(12.4)).toBe(12.4);
    const stop = vi.fn();
    const revoke = vi.fn();
    releaseRecordingResources({ getTracks: () => [{ stop }] } as unknown as MediaStream, 'blob:preview', revoke);
    expect(stop).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith('blob:preview');
  });

  it('libera a prévia anterior antes de uma regravação', () => {
    const revoke = vi.fn();
    releaseRecordingResources(null, 'blob:primeira-gravacao', revoke);
    releaseRecordingResources(null, 'blob:segunda-gravacao', revoke);
    expect(revoke).toHaveBeenNthCalledWith(1, 'blob:primeira-gravacao');
    expect(revoke).toHaveBeenNthCalledWith(2, 'blob:segunda-gravacao');
  });
});
