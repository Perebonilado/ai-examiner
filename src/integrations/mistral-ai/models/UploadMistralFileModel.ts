export interface UploadMistralFileModel {
  id: string;
  object: string;
  bytes: number;
  created_at: number;
  filename: string;
  purpose: string;
  sample_type: string;
  num_lines: number | null;
  source: string;
}
