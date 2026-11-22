export interface SendEmailModel {
  subject: string;
  /** Plain-text version (always sent, for clients that don't show HTML). */
  text: string;
  /** HTML version from the shared email layout (see ../templates). */
  html?: string;
  receiverEmail: string;
  attachments?: Express.Multer.File[]
}
