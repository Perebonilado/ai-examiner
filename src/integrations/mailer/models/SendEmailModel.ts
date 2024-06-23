export interface SendEmailModel {
  subject: string;
  text: string;
  receiverEmail: string;
  attachments?: Express.Multer.File[]
}
