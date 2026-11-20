import {
  ArrowUpRight,
  Check,
  Copy,
  ExternalLink,
  MessageSquareQuote,
  Search,
} from "lucide-react";
import { useEffect, useState, type FC, type MouseEvent } from "react";

export interface ArchivedLinkItem {
  link_id: number;
  url: string;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  domain: string | null;
  saved_at: string;
  post_id: number;
  root_id: number;
  post_snippet: string;
}

interface LinkArchiveViewProps {
  /** 원본 타래로 점프할 때 호출 (rootId: 타래 최상단 ID, focusPostId: 강조할 특정 글 ID) */
  onJumpToThread: (rootId: number, focusPostId: number) => void;
}

const LinkArchiveView: FC<LinkArchiveViewProps> = ({ onJumpToThread }) => {
  const [links, setLinks] = useState<ArchivedLinkItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchLinks = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (searchQuery.trim()) params.set("q", searchQuery.trim());
        if (selectedDomain) params.set("domain", selectedDomain);

        const res = await fetch(`/api/links?${params.toString}`);
        if (res.ok) {
          const data = await res.json();
          setLinks(data.items || []);
        }
      } catch (err) {
        console.error("링크 아카이브 로드 실패:", err);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(fetchLinks, 250);
    return () => clearTimeout(debounce);
  }, [searchQuery, selectedDomain]);

  const handleCopy = async (e: MouseEvent, item: ArchivedLinkItem) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(item.url);
    setCopiedId(item.link_id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // 현재 목록에서 추출한 주요 도메인 필터 칩
  const uniqueDomains = Array.from(
    new Set(links.map((l) => l.domain).filter(Boolean)),
  ) as string[];

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* 검색 입력창 */}
      <div className="relative">
        <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="저장한 링크 제목, URL 또는 내 메모 검색..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 transition"
        />
      </div>

      {/* 도메인 빠른 필터 칩 */}
      {uniqueDomains.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedDomain(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 transition ${
              selectedDomain === null
                ? "bg-neutral-100 text-neutral-950"
                : "bg-neutral-900 text-neutral-400 hover:text-neutral-200 border border-neutral-800"
            }`}
          >
            전체
          </button>
          {uniqueDomains.map((domain) => (
            <button
              key={domain}
              type="button"
              onClick={() =>
                setSelectedDomain(selectedDomain === domain ? null : domain)
              }
              className={`
                  px-3 py-1 rounded-full text-xs font-medium shrink-0 transition ${
                    selectedDomain === domain
                      ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                      : "bg-neutral-900 text-neutral-400 hover:text-neutral-200 border border-neutral-800"
                  }`}
            >
              {domain}
            </button>
          ))}
        </div>
      )}

      {/* 링크 카드 리스트 */}
      {isLoading ? (
        <div className="py-12 text-center text-xs text-neutral-500">
          아카이브를 불러오는 중...
        </div>
      ) : links.length === 0 ? (
        <div className="py-16 text-center text-sm text-neutral-500">
          저장된 링크가 없습니다. 피드에 URL을 포함해 글을 남겨보세요!
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {links.map((item) => (
            <div
              key={item.link_id}
              className="rounded-xl border border-neutral-800 bg-neutral-900/50 hover:border-neutral-700 transition overflow-hidden"
            >
              {/* 상단: OG 메타데이터 영역 */}
              <div className="relative flex p-3.5 gap-3.5">
                {item.og_image && (
                  <img
                    src={item.og_image}
                    alt={item.og_title || "썸네일"}
                    className="w-20 h-20 rounded-lg object-cover shrink-0 bg-neutral-800"
                  />
                )}
                <div className="flex-1 min-w-0 pr-8">
                  <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                    <span>{item.domain}</span>
                    <span>•</span>
                    <span>
                      {new Date(item.saved_at).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 text-sm font-semibold text-neutral-100 hover:text-sky-400 transition line-clamp-1 flex items-center gap-1"
                  >
                    <span className="truncate">
                      {item.og_title || item.url}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-60" />
                  </a>
                  {item.og_description && (
                    <p className="mt-1 text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                      {item.og_description}
                    </p>
                  )}
                </div>

                {/* 우측 상단 원클릭 링크 복사 버튼 */}
                <button
                  type="button"
                  onClick={(e) => handleCopy(e, item)}
                  title="원본 링크 복사"
                  className="absolute top-3 right-3 p-2 rounded-lg bg-neutral-800/80 text-neutral-400 hover:text-white hover:bg-neutral-700 transition"
                >
                  {copiedId === item.link_id ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* 하단: 내 코멘트 스니펫 + 원본 타래 점프 버튼 */}
              <div className="px-3.5 py-2.5 bg-neutral-950/60 border-t border-neutral-800/70 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0 text-xs text-neutral-400">
                  <MessageSquareQuote className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                  <span className="truncate">
                    {item.post_snippet || "(코멘트 없이 링크만 저장됨)"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onJumpToThread(item.root_id, item.post_id)}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition"
                >
                  <span>원본 타래</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-sky-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LinkArchiveView;
