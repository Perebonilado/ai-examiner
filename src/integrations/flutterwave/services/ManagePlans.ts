import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { AxiosResponse } from 'axios';

@Injectable()
export class ManagePlans {
    constructor(private httpService: HttpService){}

    baseUrl = 'https://api.flutterwave.com/v3';
}