export interface PostImage {
  id: number;
  url: string;
}

export interface PostLink {
  id: number;
  url: string;
  og_title?: string | null;
  og_description?: string | null;
  og_image?: string | null;
  domain?: string | null;
}

export interface PostItem {
  id: number;
  parent_id: number | null;
  root_id: number;
  content: string;
  created_at: string;
  images: PostImage[];
  links: PostLink[];
}
