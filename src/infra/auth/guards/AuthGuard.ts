import {
    CanActivate,
    ExecutionContext,
    HttpException,
    HttpStatus,
    Injectable,
  } from '@nestjs/common';
  import { JwtService } from '@nestjs/jwt';
  import { Request } from 'express';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
  
  @Injectable()
  export class AuthGuard implements CanActivate {
    constructor(private jwtService: JwtService) {}
  
    async canActivate(context: ExecutionContext) {
      const request = context.switchToHttp().getRequest();
      const token = this.extractTokenFromHeader(request);
  
      if (!token) {
        throw new HttpException(
          `No bearer token passed`,
          HttpStatus.UNAUTHORIZED,
        );
      }
  
      try {
        const payload = await this.jwtService.verifyAsync(token, {
          secret: EnvironmentVariables.config.jwtSecret,
        });
  
        request['user'] = payload;
      } catch (error) {
        throw new HttpException(`Invalid token: ${error.message}`, HttpStatus.UNAUTHORIZED);
      }
  
      return true;
    }
  
    private extractTokenFromHeader(request: Request): string | undefined {
      const [type, token] = request.headers.authorization?.split(' ') ?? [];
      return type === 'Bearer' ? token : undefined;
    }
  }