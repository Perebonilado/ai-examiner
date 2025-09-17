import { PDFContent } from "src/utils";

export interface CreateStoredFileRequest {
  originalFileId: string;
  modifiedContent?: string;
  sprintReadContent?: PDFContent[][];
  documentId: string;
  currentFileFormat: string;
}
