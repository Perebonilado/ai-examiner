import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Inject,
  Get,
  UseGuards,
  Req,
  Post,
  Put,
} from '@nestjs/common';
import * as moment from 'moment';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { Request } from 'express';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { CreatePreferredLanguageHandler } from 'src/business/handlers/PreferredLanguage/CreatePreferredLanguageHandler';
import { UpdatePreferredLanguageHandler } from 'src/business/handlers/PreferredLanguage/UpdatePreferredLanguageHandler';
import { PreferredLanguageQueryService } from 'src/query/services/PreferredLanguageQueryService';
import { CreatePreferredLanguageDto } from 'src/dto/CreatePreferredLanguageDto';
import { UpdatePreferredLanguageDto } from 'src/dto/UpdatePreferredLanguageDto';

@Controller('preferred-language')
export class PreferredLanguageController {
  constructor(
    @Inject(CreatePreferredLanguageHandler)
    private createPreferredLanguageHandler: CreatePreferredLanguageHandler,
    @Inject(UpdatePreferredLanguageHandler)
    private updatePreferredLanguageHandler: UpdatePreferredLanguageHandler,
    @Inject(PreferredLanguageQueryService)
    private preferredLanguageQueryService: PreferredLanguageQueryService,
  ) {}

  @UseGuards(AuthGuard)
  @Get('')
  public async getUserPreferredLanguage(@Req() request: Request) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      const prefLang = await this.preferredLanguageQueryService.findByUserId(
        userToken.sub,
      );
      if (prefLang) {
        return {
          language: prefLang.language,
          preferredLanguageSet: true,
        };
      }

      return {
        language: 'English',
        preferredLanguageSet: false,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to find user preferred language',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Post('')
  public async createPreferredLanguage(
    @Req() request: Request,
    @Body() body: CreatePreferredLanguageDto,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      return await this.createPreferredLanguageHandler.handle({
        language: body.language,
        userId: userToken.sub,
      });
    } catch (error) {
      throw new HttpException(
        'Failed to create preferred language',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Put('')
  public async updatePreferredLanguage(
    @Req() request: Request,
    @Body() body: UpdatePreferredLanguageDto,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      return await this.updatePreferredLanguageHandler.handle({
        language: body.language,
        userId: userToken.sub,
      });
    } catch (error) {
      throw new HttpException(
        'Failed to update preferred language',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
