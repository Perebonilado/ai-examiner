export interface YoutubeSearchModel {
  query: string;
  maxResults: number;
}

export interface YouTubeSearchResponse {
    kind: string;
    etag: string;
    nextPageToken?: string;
    regionCode: string;
    pageInfo: {
      totalResults: number;
      resultsPerPage: number;
    };
    items: YouTubeVideoItem[];
  }
  
  export interface YouTubeVideoItem {
    kind: string;
    etag: string;
    id: {
      kind: string;
      videoId: string;
    };
    snippet: {
      publishedAt: string;
      channelId: string;
      title: string;
      description: string;
      thumbnails: {
        default: YouTubeThumbnail;
        medium: YouTubeThumbnail;
        high: YouTubeThumbnail;
      };
      channelTitle: string;
      liveBroadcastContent: string;
      publishTime: string;
    };
  }
  
  export interface YouTubeThumbnail {
    url: string;
    width: number;
    height: number;
  }
  