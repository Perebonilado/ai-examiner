import { PDFContent } from "src/utils";

export interface UpdateStoredFileRequest {
  id: string;
  modifiedContent: PDFContent[][];
}
