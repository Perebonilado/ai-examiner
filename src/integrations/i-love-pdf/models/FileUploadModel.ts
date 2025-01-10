export interface UploadFilePayloadModel {
  task: string;
  file: Express.Multer.File;
}

export interface FileUploadModel {
  server_filename: string;
}
