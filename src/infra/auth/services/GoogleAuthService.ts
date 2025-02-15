import { Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { EnvironmentVariables } from 'src/EnvironmentVariables';

@Injectable()
export class GoogleAuthService {
  async verifyGoogleToken(token: string, platformOs: string) {
    const authIDToUse =
      platformOs.toLowerCase() === 'ios'
        ? EnvironmentVariables.config.firebaseIOSOAuthClientId
        : EnvironmentVariables.config.firebaseWebOAuthClientId;
    const client = new OAuth2Client(authIDToUse);
    try {
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: authIDToUse,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new UnauthorizedException('Invalid Google token');
      }

      return {
        email: payload.email,
        firstName: payload.given_name,
        lastName: payload.family_name,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid Google token');
    }
  }
}
