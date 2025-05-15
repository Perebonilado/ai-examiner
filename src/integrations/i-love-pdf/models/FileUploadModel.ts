export interface UploadFilePayloadModel {
  task: string;
  file: FileModel;
}

export interface FileModel {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

export interface FileUploadModel {
  server_filename: string;
}
