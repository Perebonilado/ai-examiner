import { ToolType } from './ToolModel';

export interface ProcessFileModel {
  download_filename: string;
  filesize: number;
  output_filesize: number;
  output_filenumber: number;
  output_extensions: string;
  timer: string;
  status: Status;
}

export interface ProcessFilePayloadModel {
  task: string;
  tool: ToolType;
  files: File[];
}

interface File {
  server_filename: string;
  filename: string;
}

type Status = 
  | "FileSuccess" // This file has been processed successfully.
  | "FileWaiting" // This file is waiting to be processed.
  | "WrongPassword" // This file has not been processed because it needed a password and was not provided or incorrect.
  | "TimeOut" // This file has not been processed correctly because it took more than your time limit to process it.
  | "ServerFileNotFound" // This file has not been processed because it has not been found on the server.
  | "DamagedFile" // This file has not been processed because it was damaged or we were unable to read it.
  | "NoImages" // This file has not been processed because we couldn't find any images to extract. Maybe there are vectors?
  | "OutOfRange" // This file has not been processed because some of the ranges do not match the number of pages.
  | "NonConformant" // PDF file validation has not passed against PDF/A conformance provided.
  | "UnknownError"; // Unknown error.

