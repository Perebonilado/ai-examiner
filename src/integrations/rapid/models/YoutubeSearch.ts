export interface YoutubeSearchPayload {
  searchQuery: string;
}

export interface YoutubeSearchModelRapid {
  videoId: string;
  thumbnail: string;
  title: string;
  author: {
    profile: string;
    name: string;
  };
  viewCount: string;
  duration: string;
  published: string;
  description: string;
}
