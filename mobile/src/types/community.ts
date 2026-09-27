export interface CommunityPost {
  id: number;
  user_id: string | null;
  created_at: string;
  content: string;
  nickname: string | null;
  avatar_url: string | null;
  title: string | null;
  category: string | null;
  parent_id: number | null;
  likeCount: number;
  replyCount: number;
  liked: boolean;
}

export interface CommunityReply {
  id: number;
  user_id: string | null;
  created_at: string;
  content: string;
  nickname: string | null;
  avatar_url: string | null;
  parent_id: number;
}

export interface CommunityPage {
  posts: CommunityPost[];
  total: number;
}

export interface Profile {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
  created_at?: string;
}
