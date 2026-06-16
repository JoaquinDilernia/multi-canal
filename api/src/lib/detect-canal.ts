export type Canal = 'meta' | 'google' | 'tiktok' | 'email' | 'organico' | 'referral' | 'directo';

export interface TouchParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  gclid?: string;
  ttclid?: string;
  epik?: string;
  referrer?: string;
}

export interface CanalResult {
  canal: Canal;
  sub_canal: string | null;
}

export function detectCanal(params: TouchParams): CanalResult {
  // Click IDs de plataformas pagas — máxima prioridad
  if (params.fbclid) return { canal: 'meta', sub_canal: params.utm_campaign ?? null };
  if (params.gclid) return { canal: 'google', sub_canal: params.utm_campaign ?? null };
  if (params.ttclid) return { canal: 'tiktok', sub_canal: params.utm_campaign ?? null };

  // UTMs explícitos
  if (params.utm_source) {
    const src = params.utm_source.toLowerCase();
    const campaign = params.utm_campaign ?? null;

    if (src.includes('facebook') || src.includes('instagram') || src.includes('meta')) {
      return { canal: 'meta', sub_canal: campaign };
    }
    if (src.includes('google')) {
      return { canal: 'google', sub_canal: campaign };
    }
    if (src.includes('tiktok')) {
      return { canal: 'tiktok', sub_canal: campaign };
    }
    if (src.includes('email') || src.includes('newsletter') || src.includes('perfit')) {
      return { canal: 'email', sub_canal: campaign };
    }
    return { canal: 'referral', sub_canal: params.utm_source };
  }

  // Inferir desde referrer
  if (!params.referrer) return { canal: 'directo', sub_canal: null };

  try {
    const refHost = new URL(params.referrer).hostname;

    if (refHost.includes('google.') || refHost.includes('bing.') || refHost.includes('yahoo.')) {
      return { canal: 'organico', sub_canal: refHost };
    }
    if (refHost.includes('facebook.com') || refHost.includes('instagram.com')) {
      return { canal: 'meta', sub_canal: null };
    }
    if (refHost.includes('tiktok.com')) {
      return { canal: 'tiktok', sub_canal: null };
    }
    return { canal: 'referral', sub_canal: refHost };
  } catch {
    return { canal: 'directo', sub_canal: null };
  }
}
