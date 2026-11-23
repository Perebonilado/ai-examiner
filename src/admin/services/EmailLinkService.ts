import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EnvironmentVariables } from 'src/EnvironmentVariables';

/** Signed tokens for links inside marketing emails: unsubscribe and click tracking. */
@Injectable()
export class EmailLinkService {
  constructor(private jwt: JwtService) {}

  private get secret() {
    return EnvironmentVariables.config.jwtSecret;
  }

  /** Never expires: an unsubscribe link must keep working for as long as the email exists. */
  preferenceToken(userId: string, campaignId?: string | null): string {
    return this.jwt.sign(
      { sub: userId, p: 'ep', ...(campaignId ? { c: campaignId } : {}) },
      { secret: this.secret },
    );
  }

  readPreferenceToken(
    token: string,
  ): { userId: string; campaignId: string | null } | null {
    try {
      const v = this.jwt.verify(token, { secret: this.secret }) as {
        sub?: string;
        p?: string;
        c?: string;
      };
      return v?.p === 'ep' && v.sub
        ? { userId: v.sub, campaignId: v.c ?? null }
        : null;
    } catch {
      return null;
    }
  }

  clickToken(
    campaignId: string,
    userId: string,
    url: string,
    label: string,
  ): string {
    return this.jwt.sign(
      { p: 'ck', c: campaignId, u: userId, url, l: label.slice(0, 80) },
      { secret: this.secret },
    );
  }

  readClickToken(
    token: string,
  ): { campaignId: string; userId: string; url: string; label: string } | null {
    try {
      const v = this.jwt.verify(token, { secret: this.secret }) as Record<
        string,
        string
      >;
      if (v?.p !== 'ck' || !v.url || !/^https?:\/\//i.test(v.url)) return null;
      return { campaignId: v.c, userId: v.u, url: v.url, label: v.l || '' };
    } catch {
      return null;
    }
  }

  unsubscribePageUrl(token: string): string {
    const base = (
      EnvironmentVariables.config.frontendBaseUrl || 'https://aiexaminer.app'
    ).replace(/\/+$/, '');
    return `${base}/unsubscribe?token=${encodeURIComponent(token)}`;
  }

  /** Click-tracked url, or the url itself when this API's public address isn't configured. */
  trackedUrl(
    campaignId: string,
    userId: string,
    url: string,
    label: string,
  ): string {
    const api = EnvironmentVariables.config.backendPublicUrl;
    if (!api || !/^https?:\/\//i.test(url)) return url;
    return `${api}/api/v1/email/c/${this.clickToken(campaignId, userId, url, label)}`;
  }

  /** RFC 8058 headers: mail apps show their own "Unsubscribe" button. */
  listUnsubscribeHeaders(token: string): Record<string, string> {
    const api = EnvironmentVariables.config.backendPublicUrl;
    const mailbox = EnvironmentVariables.config.emailUser;
    const parts: string[] = [];
    if (api)
      parts.push(
        `<${api}/api/v1/email/unsubscribe/one-click?token=${encodeURIComponent(token)}>`,
      );
    if (mailbox && mailbox.includes('@'))
      parts.push(`<mailto:${mailbox}?subject=unsubscribe>`);
    const headers: Record<string, string> = {};
    if (parts.length) headers['List-Unsubscribe'] = parts.join(', ');
    if (api) headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    return headers;
  }
}
