import {
  Check,
  Hash,
  Layers,
  Link2,
  Pin,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useRef, useState, type FC } from "react";

export interface TagItem {
  id: number;
  name: string;
  is_pinned: boolean;
  post_count: number;
}

interface TagHeaderBarProps {
  activeTab: "feed" | "links";
  onChangeTab: (tab: "feed" | "links") => void;
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  /** 글 작성 후 새 태그가 생겼을 때 목록 갱신용 트리거 카운트 */
  refreshTrigger?: number;
}

export const TagHeaderBar: FC<TagHeaderBarProps> = ({
  activeTab,
  onChangeTab,
  selectedTag,
  onSelectTag,
  refreshTrigger = 0,
}) => {
  const [tags, setTags] = useState<TagItem[]>([]);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // 전체 태그 목록 조회 (백엔드에서 핀 고정 우선 -> 사용빈도 순으로 정렬되어 내려옴)
  const fetchTags = async () => {
    try {
      const res = await fetch("/api/tags");
      if (res.ok) {
        const data: TagItem[] = await res.json();
        setTags(data);
      }
    } catch (err) {
      console.error("태그 목록 로드 실패:", err);
    }
  };

  useEffect(() => {
    fetchTags();
  }, [refreshTrigger]);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsManageOpen(false);
      }
    };
    if (isManageOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isManageOpen]);

  // 핀 고정 토글 핸들러 (낙관적 업데이트 적용)
  const handleTogglePin = async (tag: TagItem) => {
    if (togglingId === tag.id) return;
    setTogglingId(tag.id);

    // UI 즉시 반영
    setTags((prev) =>
      prev.map((t) =>
        t.id === tag.id ? { ...t, is_pinned: !t.is_pinned } : t,
      ),
    );

    try {
      const res = await fetch(`/api/tags/${tag.id}/pin`, { method: "PATCH" });
      if (res.ok) {
        await fetchTags(); // 정렬 순서 재동기화
      }
    } catch (err) {
      console.error("핀 토글 실패:", err);
      await fetchTags(); // 실패 시 롤백
    } finally {
      setTogglingId(null);
    }
  };

  const pinnedTags = tags.filter((t) => t.is_pinned);
  // 핀 고정은 안 되어 있지만 현재 필터링 중인 태그가 있다면 탭에 임시 노출
  const isSelectedUnpinned =
    selectedTag !== null && !pinnedTags.some((t) => t.name === selectedTag);

  return (
    <header className="sticky top-0 z-20 bg-[#101010]/85 backdrop-blur-md border-b border-neutral-800/80">
      {/* 1단: 메인 뷰 전환 탭 (타임라인 피드 vs 링크 아카이브) */}
      <div className="grid grid-cols-2 border-b border-neutral-800/60">
        <button
          type="button"
          onClick={() => onChangeTab("feed")}
          className={`py-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${
            activeTab === "feed"
              ? "border-neutral-100 text-neutral-100"
              : "border-transparent text-neutral-500 hover:text-neutral-300"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>타임라인</span>
        </button>

        <button
          type="button"
          onClick={() => onChangeTab("links")}
          className={`py-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${
            activeTab === "links"
              ? "border-neutral-100 text-neutral-100"
              : "border-transparent text-neutral-500 hover:text-neutral-300"
          }`}
        >
          <Link2 className="w-3.5 h-3.5" />
          <span>링크 아카이브</span>
        </button>
      </div>

      {/* 2단: 타임라인 탭일 때만 고정 해시태그 필터 바 노출 */}
      {activeTab === "feed" && (
        <div className="relative flex items-center justify-between px-3 py-2 gap-2">
          {/* 가로 스크롤 고정 태그 칩 영역 */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1">
            <button
              type="button"
              onClick={() => onSelectTag(null)}
              className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 transition ${
                selectedTag === null
                  ? "bg-neutral-100 text-neutral-950"
                  : "bg-neutral-900 text-neutral-400 hover:text-neutral-200 border border-neutral-800"
              }`}
            >
              전체
            </button>

            {pinnedTags.map((tag) => {
              const isSelected = selectedTag === tag.name;
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => onSelectTag(isSelected ? null : tag.name)}
                  className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 flex items-center gap-0.5 transition ${
                    isSelected
                      ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                      : "bg-neutral-900 text-neutral-400 hover:text-neutral-200 border border-neutral-800"
                  }`}
                >
                  <span className="opacity-60">#</span>
                  <span>{tag.name}</span>
                </button>
              );
            })}

            {/* 핀 고정되지 않은 태그를 본문에서 눌러 필터링 중일 때 임시 표시 */}
            {isSelectedUnpinned && selectedTag && (
              <button
                type="button"
                onClick={() => onSelectTag(null)}
                className="px-3 py-1 rounded-full text-xs font-medium shrink-0 flex items-center gap-1 bg-sky-500/20 text-sky-300 border border-dashed border-sky-500/50"
              >
                <span>#{selectedTag}</span>
                <span className="text-[10px] opacity-75">×</span>
              </button>
            )}
          </div>

          {/* 우측 태그 핀 관리 드롭다운 버튼 */}
          <div className="relative shrink-0" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsManageOpen((prev) => !prev)}
              title="상단 고정 태그 관리"
              className={`p-1.5 rounded-lg border transition ${
                isManageOpen
                  ? "bg-neutral-800 border-neutral-600 text-neutral-100"
                  : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>

            {/* 태그 핀 관리 드롭다운 패널 */}
            {isManageOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl bg-neutral-900 border border-neutral-700/80 shadow-2xl py-2 z-30">
                <div className="px-3 py-1.5 border-b border-neutral-800 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-neutral-300">
                    상단 탭 고정 해시태그
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    {pinnedTags.length}개 고정됨
                  </span>
                </div>

                <div className="max-h-64 overflow-y-auto divide-y divide-neutral-800/50">
                  {tags.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-neutral-500">
                      아직 작성된 해시태그가 없습니다.
                    </div>
                  ) : (
                    tags.map((tag) => (
                      <div
                        key={tag.id}
                        className="flex items-center justify-between px-3 py-2 hover:bg-neutral-800/60 transition"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onSelectTag(tag.name);
                            setIsManageOpen(false);
                          }}
                          className="flex items-center gap-1.5 text-left min-w-0 flex-1"
                        >
                          <Hash className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          <span className="text-xs text-neutral-200 truncate">
                            {tag.name}
                          </span>
                          <span className="text-[10px] text-neutral-500 shrink-0">
                            ({tag.post_count})
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleTogglePin(tag)}
                          title={
                            tag.is_pinned ? "상단 고정 해제" : "상단 탭에 고정"
                          }
                          className={`p-1.5 rounded-md transition ${
                            tag.is_pinned
                              ? "bg-sky-500/20 text-sky-400 hover:bg-sky-500/30"
                              : "text-neutral-500 hover:text-neutral-200 hover:bg-neutral-700/60"
                          }`}
                        >
                          {tag.is_pinned ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Pin className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
