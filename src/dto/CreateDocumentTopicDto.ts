export interface CreateDocumentTopicDto {
  title: string;
  documentId: string;
  userId: string;
  startPage: number | null;
  endPage: number | null;
  shortDescription: string | null
}
