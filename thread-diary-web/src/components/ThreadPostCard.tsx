import { useState, type FC } from "react";
import type { PostItem } from "../types/post";
import { Check, Copy, ExternalLink, MessageCircle } from "lucide-react";

interface ThreadPostCardProps {
  post: PostItem;
  hasNextInThread: boolean; // 다음 타래 글이 이어지는지 여부 (세로 연결선 표시용)
  isHighlighted?: boolean; // 링크 역추적으로 점프했을 때 강조 표시
  onReplyClick: (post: PostItem) => void;
  onTagClick: (tag: string) => void;
}

const ThreadPostCard: FC<ThreadPostCardProps> = ({
  post,
  hasNextInThread,
  isHighlighted = false,
  onReplyClick,
  onTagClick,
}) => {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const handleCopyLink = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 1500);
  };

  // 본문 내 #해시태그를 클릭 가능한 포인트 컬러 텍스트로 렌더링
  const renderFormattedContent = (text: string) => {
    const parts = text.split(/(#[가-힣a-zA-Z0-9_]+)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("#")) {
        const tagName = part.slice(1);
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onTagClick(tagName)}
            className="text-sky-400 hover:underline font-medium"
          >
            {part}
          </button>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  const formattedTime = new Date(post.created_at).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <article
      id={`post-${post.id}`}
      className={`flex gap-3.5 px-4 pt-3 transition-colors duration-700 ${
        isHighlighted ? "bg-sky-950/30 rounded-xl" : ""
      } ${hasNextInThread ? "pb-1" : "pb-4 border-b border-neutral-800/80"}`}
    >
      {/* 좌측 컬럼: 노드 아이콘 + 타래 세로 연결선 */}
      <div className="flex flex-col items-center shrink-0 w-9">
        <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xs font-semibold text-neutral-300 select-none">
          ME
        </div>
        {hasNextInThread && (
          <div className="w-[1.5px] flex-1 bg-neutral-700/80 my-1.5 rounded-full min-h-[24px]" />
        )}
      </div>

      {/* 우측 컬럼: 타임스탬프 + 본문 + 이미지 + OG 링크 카드 */}
      <div className="flex-1 min-w-0 pb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-mono text-neutral-500">
            {formattedTime}
          </span>
        </div>

        {/* 본문 */}
        <p className="text-[15px] leading-[1.6] text-neutral-100 whitespace-pre-wrap wrap-break-word">
          {renderFormattedContent(post.content)}
        </p>

        {/* 첨부 이미지 그리드 */}
        {post.images.length > 0 && (
          <div
            className={`mt-2.5 grid gap-2 ${
              post.images.length > 1 ? "grid-cols-2" : "grid-cols-1"
            }`}
          >
            {post.images.map((img) => (
              <img
                key={img.id}
                src={img.url}
                alt="첨부 이미지"
                className="rounded-xl border border-neutral-800 max-h-80 w-full object-cover bg-neutral-900"
              />
            ))}
          </div>
        )}

        {/* OG 링크 미리보기 카드 & 원클릭 복사 */}
        {post.links.length > 0 && (
          <div className="mt-2.5 flex flex-col gap-2">
            {post.links.map((link) => (
              <div
                key={link.id}
                className="group relative flex items-stretch rounded-xl border border-neutral-800 bg-neutral-900/70 hover:border-neutral-700 overflow-hidden transition"
              >
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex min-w-0 p-3 gap-3"
                >
                  {link.og_image && (
                    <img
                      src={link.og_image}
                      alt={link.og_title || "링크 썸네일"}
                      className="w-16 h-16 rounded-lg object-cover shrink-0 bg-neutral-800"
                    />
                  )}
                  <div className="flex flex-col justify-center min-w-0 flex-1 pr-6">
                    <span className="text-[11px] text-neutral-500 flex items-center gap-1">
                      {link.domain}
                      <ExternalLink className="w-3 h-3 opacity-60" />
                    </span>
                    <h4 className="text-sm font-medium text-neutral-200 truncate mt-0.5">
                      {link.og_title || link.url}
                    </h4>
                    {link.og_description && (
                      <p className="text-xs text-neutral-400 line-clamp-1 mt-0.5">
                        {link.og_description}
                      </p>
                    )}
                  </div>
                </a>

                {/* 원클릭 URL 복사 버튼 */}
                <button
                  type="button"
                  onClick={() => handleCopyLink(link.url)}
                  title="링크 복사"
                  className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-neutral-800/90 text-neutral-400 hover:text-white hover:bg-neutral-700 transition"
                >
                  {copiedUrl === link.url ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 하단 액션: 타래 잇기 버튼 */}
        <div className="mt-2.5 flex items-center gap-4">
          <button
            type="button"
            onClick={() => onReplyClick(post)}
            className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-200 transition"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>타래 잇기</span>
          </button>
        </div>
      </div>
    </article>
  );
};

export default ThreadPostCard;
