import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { UserQueryService } from 'src/query/services/UserQueryService';
import { verifyPassword } from 'src/utils';
import { JwtService } from '@nestjs/jwt';
import { LoginUserDto } from 'src/dto/LoginUserDto';
import { VerifiedTokenModel } from '../models/VerifiedTokenModel';

@Injectable()
export class AuthService {
  constructor(
    @Inject(UserQueryService) private userQueryService: UserQueryService,
    private jwtService: JwtService,
  ) {}

  async signIn(payload: LoginUserDto) {
    const user = await this.userQueryService.findOne(payload.email);
    if (user) {
      const isMatch = await verifyPassword(payload.password, user.password);

      if (isMatch) {
        const { id, email } = user;
        const payload: VerifiedTokenModel = {
          sub: id,
          email,
        };

        return {
          status: HttpStatus.OK,
          accessToken: await this.jwtService.signAsync(payload),
          message: 'Successful',
        };
      } else {
        throw new HttpException(
          'Wrong email/password combination',
          HttpStatus.UNAUTHORIZED,
        );
      }
    } else {
      throw new HttpException(
        'User does not exist with this email',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }
}