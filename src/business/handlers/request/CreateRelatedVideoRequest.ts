import { RelatedVideoSourceType } from 'src/infra/web/models/RelatedVideoSourceType';
import { YoutubeSearchModelRapid } from 'src/integrations/rapid/models/YoutubeSearch';

export interface CreateRelatedVideoRequest {
  data: YoutubeSearchModelRapid[];
  source: RelatedVideoSourceType;
  documentId: string;
}
