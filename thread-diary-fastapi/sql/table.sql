-- 1. 게시글 & 타래 테이블
CREATE TABLE posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER NULL,          -- 직전 부모 게시글 ID (루트 글이면 NULL)
    root_id INTEGER NULL,            -- 타래의 최상단 루트 게시글 ID (루트 글이면 자기 자신의 ID로 업데이트)
    content TEXT NOT NULL,           -- 본문 텍스트 (마크다운 또는 일반 텍스트)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES posts(id) ON DELETE SET NULL,
    FOREIGN KEY (root_id) REFERENCES posts(id) ON DELETE CASCADE
);

-- 날짜별 조회 및 타래 스레드 조회 성능 최적화 인덱스
CREATE INDEX idx_posts_root_id ON posts(root_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);

-- 2. 해시태그 마스터 테이블
CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(50) NOT NULL UNIQUE, -- '#' 제외한 순수 태그명 (예: '개발', '잡생각')
    is_pinned BOOLEAN DEFAULT 0       -- 상단 탭 고정 여부
);

-- 3. 게시글-해시태그 매핑 (N:M)
CREATE TABLE post_tags (
    post_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (post_id, tag_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- 4. 첨부 이미지 테이블 (로컬 디스크 경로 매핑)
CREATE TABLE post_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    file_path VARCHAR(255) NOT NULL,  -- 예: '/uploads/2026/11/uuid-filename.png'
    original_name VARCHAR(255),
    display_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

-- 5. 링크 및 OG 메타데이터 아카이브 테이블
CREATE TABLE post_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,         -- 이 링크가 포함된 원본 게시글 ID (역추적용)
    url TEXT NOT NULL,                -- 원본 URL
    og_title VARCHAR(255),            -- Open Graph 제목
    og_description TEXT,              -- Open Graph 요약 설명
    og_image TEXT,                    -- 썸네일 이미지 URL
    domain VARCHAR(100),              -- 예: 'x.com', 'velog.io', 'github.com'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE INDEX idx_post_links_created_at ON post_links(created_at DESC);