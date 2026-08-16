/**
 * Canal e-mail (I5) — cœur PUR de la config + comportement des deux mailers (sans réseau
 * réel : `fetch` est mocké). Prouve : dev journalise (n'envoie jamais), prod+clé envoie,
 * la redirection de test force la destination, et les erreurs HTTP/réseau ne jettent pas.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  resolveMailConfig,
  effectiveRecipient,
  LogMailer,
  ResendMailer,
  DEFAULT_MAIL_FROM,
  type EmailMessage,
} from './mailer';

const MSG: EmailMessage = {
  to: 'resident@example.com',
  subject: 'Bonjour',
  html: '<p>Salut</p>',
  text: 'Salut',
};

describe('resolveMailConfig (pur)', () => {
  it('dev (hors production) → journalise, jamais d’envoi', () => {
    expect(resolveMailConfig({ NODE_ENV: 'development', RESEND_API_KEY: 'x' }).mode).toBe('log');
  });
  it('production SANS clé → journalise', () => {
    expect(resolveMailConfig({ NODE_ENV: 'production' }).mode).toBe('log');
  });
  it('production AVEC clé → envoie', () => {
    const c = resolveMailConfig({ NODE_ENV: 'production', RESEND_API_KEY: 'key' });
    expect(c.mode).toBe('send');
    expect(c.apiKey).toBe('key');
  });
  it('expéditeur par défaut = adresse de test Resend, surchargée par MAIL_FROM', () => {
    expect(resolveMailConfig({}).from).toBe(DEFAULT_MAIL_FROM);
    expect(resolveMailConfig({ MAIL_FROM: 'Syndici <no-reply@acme.ma>' }).from).toBe(
      'Syndici <no-reply@acme.ma>',
    );
  });
  it('MAIL_REDIRECT_TO capté', () => {
    expect(resolveMailConfig({ MAIL_REDIRECT_TO: 'me@acme.ma' }).redirectTo).toBe('me@acme.ma');
    expect(resolveMailConfig({}).redirectTo).toBeNull();
  });
});

describe('effectiveRecipient', () => {
  it('redirige tout vers l’adresse de test si configurée', () => {
    expect(effectiveRecipient('a@b.com', 'me@acme.ma')).toBe('me@acme.ma');
    expect(effectiveRecipient('a@b.com', null)).toBe('a@b.com');
  });
});

describe('LogMailer', () => {
  it('journalise et n’envoie rien (aucun appel réseau)', async () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const res = await new LogMailer('test').send(MSG);
    expect(res).toEqual({ ok: true, skipped: true });
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});

describe('ResendMailer (fetch mocké)', () => {
  type FetchCall = [string, RequestInit];

  it('POST vers Resend avec le bon en-tête et le bon corps ; renvoie l’id', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'em_1' }), { status: 200 }));
    const res = await new ResendMailer(
      { apiKey: 'key', from: 'F <f@x.com>', redirectTo: null },
      fetchMock as unknown as typeof fetch,
    ).send(MSG);
    expect(res).toEqual({ ok: true, id: 'em_1', redirectedTo: null });
    const [url, init] = fetchMock.mock.calls[0] as unknown as FetchCall;
    expect(url).toBe('https://api.resend.com/emails');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ from: 'F <f@x.com>', to: 'resident@example.com', subject: 'Bonjour' });
    expect(init.headers).toMatchObject({ Authorization: 'Bearer key' });
  });

  it('redirection : la destination réelle est l’override, le destinataire visé est rappelé', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'em_2' }), { status: 200 }));
    const res = await new ResendMailer(
      { apiKey: 'key', from: 'F <f@x.com>', redirectTo: 'me@acme.ma' },
      fetchMock as unknown as typeof fetch,
    ).send(MSG);
    expect(res).toEqual({ ok: true, id: 'em_2', redirectedTo: 'me@acme.ma' });
    const [, init] = fetchMock.mock.calls[0] as unknown as FetchCall;
    const body = JSON.parse(init.body as string);
    expect(body.to).toBe('me@acme.ma');
    expect(body.subject).toContain('[test]');
    expect(body.text).toContain('resident@example.com'); // destinataire visé rappelé
  });

  it('une réponse non-2xx ne jette pas : renvoie ok:false', async () => {
    const fetchMock = vi.fn(async () => new Response('bad', { status: 422 }));
    const res = await new ResendMailer(
      { apiKey: 'key', from: 'f', redirectTo: null },
      fetchMock as unknown as typeof fetch,
    ).send(MSG);
    expect(res.ok).toBe(false);
  });

  it('une erreur réseau ne jette pas : renvoie ok:false', async () => {
    const fetchMock = vi.fn(async (): Promise<Response> => {
      throw new Error('boom');
    });
    const res = await new ResendMailer(
      { apiKey: 'key', from: 'f', redirectTo: null },
      fetchMock as unknown as typeof fetch,
    ).send(MSG);
    expect(res).toEqual({ ok: false, error: 'boom' });
  });
});
