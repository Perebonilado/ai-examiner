import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { FileUploadResponseModel } from '../models/FileUploadResponseModel';
import { replaceAllSpacesInStringWithHyphen } from 'src/utils';

@Injectable()
export class StorageBucketService {
  constructor() {}

  private readonly s3_config = {
    region: EnvironmentVariables.config.awsServerLocation,
    credentials: {
      accessKeyId: EnvironmentVariables.config.awsAccessKey,
      secretAccessKey: EnvironmentVariables.config.awsSecretKey,
    },
  };

  private readonly client = new S3Client({ ...this.s3_config });

  public async uploadFile(
    file: Express.Multer.File,
  ): Promise<FileUploadResponseModel> {
    try {
      const { originalname } = file;
      await this.s3_upload(file, originalname);

      return {
        fileLocation: this.fileLocationUrlConstructor(
          replaceAllSpacesInStringWithHyphen(originalname),
        ),
      };
    } catch (error) {
      throw new HttpException(
        'An error occured while uploading file',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  private async s3_upload(file: Express.Multer.File, originalFileName: string) {
    const command = new PutObjectCommand({
      Bucket: EnvironmentVariables.config.awsStorageBucket,
      Key: replaceAllSpacesInStringWithHyphen(originalFileName),
      Body: file.buffer,
    });
    try {
      return await this.client.send(command);
    } catch (error) {
      throw new HttpException(
        'An error occured while uploading the file',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  private fileLocationUrlConstructor(key: string) {
    return `https://${EnvironmentVariables.config.awsStorageBucket}.s3.${EnvironmentVariables.config.awsServerLocation}.amazonaws.com/${key}`;
  }
}
