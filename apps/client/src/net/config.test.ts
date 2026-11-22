import { describe, expect, it } from 'vitest';
import { apiUrl } from '../account/api.ts';
import { movedUrl, serverUrl } from './config.ts';

const at = (href: string) => {
  const u = new URL(href);
  return { protocol: u.protocol, host: u.host, hostname: u.hostname };
};

describe('8.6 server address', () => {
  it('derives the server from the page on a same-origin build', () => {
    expect(serverUrl('same-origin', at('https://cinecards.sevend.io/?salle=AB12C'))).toBe('wss://cinecards.sevend.io');
    expect(serverUrl('same-origin', at('http://localhost:2667/'))).toBe('ws://localhost:2667');
    expect(apiUrl(serverUrl('same-origin', at('https://cinecards.sevend.io/')))).toBe('https://cinecards.sevend.io');
    expect(serverUrl('same-origin', undefined)).toBe('');
  });

  it('keeps an explicit address, the localhost default and the disabled build', () => {
    expect(serverUrl('wss://cinecards.sevend.io', at('https://seven74ai.github.io/cinecards/'))).toBe('wss://cinecards.sevend.io');
    expect(serverUrl('ws://localhost:2667', at('http://localhost:5274/'))).toBe('ws://localhost:2667');
    expect(serverUrl(undefined, at('http://localhost:5173/'))).toBe('ws://localhost:2567');
    expect(serverUrl(undefined, at('http://127.0.0.1:5173/'))).toBe('ws://127.0.0.1:2567');
    expect(serverUrl(undefined, at('https://seven74ai.github.io/cinecards/'))).toBe('');
    expect(serverUrl('', at('https://seven74ai.github.io/cinecards/'))).toBe('');
  });
});

describe('8.6 moved banner link', () => {
  it('points to the new address and keeps an invitation code', () => {
    expect(movedUrl('https://cinecards.sevend.io', '')).toBe('https://cinecards.sevend.io/');
    expect(movedUrl('https://cinecards.sevend.io', '?salle=ab12c')).toBe('https://cinecards.sevend.io/?salle=AB12C');
    expect(movedUrl('https://cinecards.sevend.io/', '?x=1&salle=AB12C')).toBe('https://cinecards.sevend.io/?salle=AB12C');
    expect(movedUrl('https://cinecards.sevend.io', '?salle=%3Cb%3E')).toBe('https://cinecards.sevend.io/');
  });

  it('shows nothing on a build that has not moved', () => {
    expect(movedUrl(undefined, '?salle=AB12C')).toBeNull();
    expect(movedUrl('', '')).toBeNull();
    expect(movedUrl('pas une adresse', '')).toBeNull();
  });
});
