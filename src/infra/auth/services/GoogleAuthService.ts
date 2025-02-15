import { Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { EnvironmentVariables } from 'src/EnvironmentVariables';

@Injectable()
export class GoogleAuthService {
  private client = new OAuth2Client(EnvironmentVariables.config.firebaseWebOAuthClientId);

  async verifyGoogleToken(token: string) {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken: token,
        audience: EnvironmentVariables.config.firebaseWebOAuthClientId, 
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
