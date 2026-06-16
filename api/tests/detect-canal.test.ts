import { describe, it, expect } from 'vitest';
import { detectCanal } from '../src/lib/detect-canal';

describe('detectCanal', () => {
  it('detecta Meta via fbclid con campaña', () => {
    expect(detectCanal({ fbclid: 'abc123', utm_campaign: 'verano' }))
      .toEqual({ canal: 'meta', sub_canal: 'verano' });
  });

  it('detecta Meta via fbclid sin campaña', () => {
    expect(detectCanal({ fbclid: 'abc123' }))
      .toEqual({ canal: 'meta', sub_canal: null });
  });

  it('detecta Google via gclid', () => {
    expect(detectCanal({ gclid: 'xyz789', utm_campaign: 'marca' }))
      .toEqual({ canal: 'google', sub_canal: 'marca' });
  });

  it('detecta TikTok via ttclid', () => {
    expect(detectCanal({ ttclid: 'tt123' }))
      .toEqual({ canal: 'tiktok', sub_canal: null });
  });

  it('detecta Meta via utm_source=facebook', () => {
    expect(detectCanal({ utm_source: 'facebook', utm_campaign: 'retargeting' }))
      .toEqual({ canal: 'meta', sub_canal: 'retargeting' });
  });

  it('detecta Meta via utm_source=instagram', () => {
    expect(detectCanal({ utm_source: 'instagram', utm_campaign: 'stories' }))
      .toEqual({ canal: 'meta', sub_canal: 'stories' });
  });

  it('detecta Google via utm_source=google', () => {
    expect(detectCanal({ utm_source: 'google', utm_campaign: 'brand' }))
      .toEqual({ canal: 'google', sub_canal: 'brand' });
  });

  it('detecta email via utm_source=perfit', () => {
    expect(detectCanal({ utm_source: 'perfit', utm_campaign: 'newsletter-junio' }))
      .toEqual({ canal: 'email', sub_canal: 'newsletter-junio' });
  });

  it('detecta email via utm_source=email', () => {
    expect(detectCanal({ utm_source: 'email', utm_campaign: 'promo' }))
      .toEqual({ canal: 'email', sub_canal: 'promo' });
  });

  it('detecta referral via utm_source desconocido', () => {
    expect(detectCanal({ utm_source: 'mercadolibre' }))
      .toEqual({ canal: 'referral', sub_canal: 'mercadolibre' });
  });

  it('detecta organico via referrer de Google', () => {
    expect(detectCanal({ referrer: 'https://www.google.com/search?q=silla+madera' }))
      .toEqual({ canal: 'organico', sub_canal: 'www.google.com' });
  });

  it('detecta organico via referrer de Bing', () => {
    expect(detectCanal({ referrer: 'https://www.bing.com/search?q=mesa' }))
      .toEqual({ canal: 'organico', sub_canal: 'www.bing.com' });
  });

  it('detecta Meta via referrer de facebook', () => {
    expect(detectCanal({ referrer: 'https://www.facebook.com/' }))
      .toEqual({ canal: 'meta', sub_canal: null });
  });

  it('detecta referral via referrer desconocido', () => {
    expect(detectCanal({ referrer: 'https://decoracion.blog/recomendaciones' }))
      .toEqual({ canal: 'referral', sub_canal: 'decoracion.blog' });
  });

  it('retorna directo cuando no hay params ni referrer', () => {
    expect(detectCanal({}))
      .toEqual({ canal: 'directo', sub_canal: null });
  });

  it('fbclid tiene prioridad sobre utm_source', () => {
    expect(detectCanal({ fbclid: 'fb123', utm_source: 'google', utm_campaign: 'test' }))
      .toEqual({ canal: 'meta', sub_canal: 'test' });
  });

  it('gclid tiene prioridad sobre utm_source facebook', () => {
    expect(detectCanal({ gclid: 'g123', utm_source: 'facebook' }))
      .toEqual({ canal: 'google', sub_canal: null });
  });

  it('referrer invalido retorna directo', () => {
    expect(detectCanal({ referrer: 'not-a-url' }))
      .toEqual({ canal: 'directo', sub_canal: null });
  });
});
