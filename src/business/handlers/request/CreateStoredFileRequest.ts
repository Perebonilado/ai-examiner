export interface CreateStoredFileRequest {
  originalFileId: string;
  modifiedContent?: string;
  documentId: string;
  currentFileFormat: string;
}
