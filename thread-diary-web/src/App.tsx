import { ArrowLeft, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ActivityHeatmap, DailyCount } from "./components/ActivityHeatmap";
import { LinkArchiveView } from "./components/LinkArchiveView";
import { PostComposer } from "./components/PostComposer";
import { TagHeaderBar } from "./components/TagHeaderBar";
import { ThreadPostCard } from "./components/ThreadPostCard";
import { PostItem } from "./types/post";

export function App() {
  // 1. 탭 및 필터 상태
  const [activeTab, setActiveTab] = useState<"feed" | "links">("feed");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // 2. 피드 & 페이징 데이터
  const [threads, setThreads] = useState<PostItem[][]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // 3. 잔디 히트맵 & 태그 갱신 트리거
  const [heatmapData, setHeatmapData] = useState<DailyCount[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // 4. 타래 답글 대상 & 링크 역추적 단일 타래 뷰 상태
  const [replyTarget, setReplyTarget] = useState<PostItem | null>(null);
  const [focusedThread, setFocusedThread] = useState<PostItem[] | null>(null);
  const [focusPostId, setFocusPostId] = useState<number | null>(null);

  // 잔디 히트맵 데이터 로드
  const fetchHeatmap = useCallback(async () => {
    try {
      const res = await fetch("/api/posts/heatmap?days=180");
      if (res.ok) {
        const data: DailyCount[] = await res.json();
        setHeatmapData(data);
      }
    } catch (err) {
      console.error("히트맵 로드 실패:", err);
    }
  }, []);

  // 메인 피드 조회 (초기 로드 및 필터 변경 시)
  const fetchFeed = useCallback(
    async (cursorParam: number | null = null, append = false) => {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoadingFeed(true);
      }

      try {
        const params = new URLSearchParams();
        params.set("limit", "20");
        if (selectedTag) params.set("tag", selectedTag);
        if (selectedDate) params.set("date", selectedDate);
        if (cursorParam !== null) params.set("cursor", String(cursorParam));

        const res = await fetch(`/api/posts?${params.toString()}`);
        if (!res.ok) throw new Error("피드 로드 실패");

        const data = await res.json();
        setThreads((prev) =>
          append ? [...prev, ...(data.threads || [])] : data.threads || [],
        );
        setNextCursor(data.next_cursor ?? null);
        setHasMore(Boolean(data.has_more));
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingFeed(false);
        setIsLoadingMore(false);
      }
    },
    [selectedTag, selectedDate],
  );

  // 초기 진입 및 필터(태그/날짜) 변경 시 피드 재조회
  useEffect(() => {
    setFocusedThread(null);
    fetchFeed(null, false);
  }, [fetchFeed]);

  // 초기 진입 및 글 작성 후 히트맵 갱신
  useEffect(() => {
    fetchHeatmap();
  }, [fetchHeatmap, refreshTrigger]);

  // 새 글 또는 타래 답글 작성 완료 핸들러
  const handlePostCreated = async () => {
    setRefreshTrigger((prev) => prev + 1);

    // 만약 링크 역추적 단일 타래 뷰 상태에서 답글을 달았다면 해당 타래도 즉시 갱신
    if (focusedThread && focusedThread.length > 0) {
      const rootId = focusedThread[0].root_id;
      const res = await fetch(`/api/posts/${rootId}/thread`);
      if (res.ok) {
        const data = await res.json();
        setFocusedThread(data.thread);
      }
    } else {
      await fetchFeed(null, false);
    }
  };

  // 링크 아카이브에서 '원본 타래' 클릭 시 점프 핸들러
  const handleJumpToThread = async (rootId: number, targetPostId: number) => {
    try {
      const res = await fetch(`/api/posts/${targetPostId}/thread`);
      if (!res.ok) return;

      const data = await res.json();
      setFocusedThread(data.thread);
      setFocusPostId(data.target_post_id);
      setActiveTab("feed");

      setTimeout(() => {
        const el = document.getElementById(`post-${data.target_post_id}`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 120);

      setTimeout(() => {
        setFocusPostId(null);
      }, 2500);
    } catch (err) {
      console.error("원본 타래 이동 실패:", err);
    }
  };

  // 본문 내 해시태그 클릭 시 필터링 적용
  const handleTagClick = (tagName: string) => {
    setFocusedThread(null);
    setSelectedTag((prev) => (prev === tagName ? null : tagName));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#101010] text-neutral-100 flex justify-center selection:bg-sky-500/30">
      <main className="w-full max-w-[600px] border-x border-neutral-800/80 min-h-screen flex flex-col">
        {/* 1. 상단 스티키 헤더 & 고정 해시태그 탭 바 */}
        <TagHeaderBar
          activeTab={activeTab}
          onChangeTab={(tab) => {
            setActiveTab(tab);
            if (tab === "links") setFocusedThread(null);
          }}
          selectedTag={selectedTag}
          onSelectTag={(tag) => {
            setFocusedThread(null);
            setSelectedTag(tag);
          }}
          refreshTrigger={refreshTrigger}
        />

        {activeTab === "links" ? (
          /* 2-A. 링크 아카이브 & 역추적 탭 */
          <LinkArchiveView onJumpToThread={handleJumpToThread} />
        ) : (
          /* 2-B. 메인 타임라인 피드 탭 */
          <>
            {/* 날짜별 잔디 히트맵 */}
            <ActivityHeatmap
              data={heatmapData}
              selectedDate={selectedDate}
              onSelectDate={(date) => {
                setFocusedThread(null);
                setSelectedDate(date);
              }}
            />

            {/* 글 작성 & Ctrl+V 이미지 붙여넣기 에디터 */}
            <PostComposer
              replyTarget={replyTarget}
              onCancelReply={() => setReplyTarget(null)}
              onPostCreated={handlePostCreated}
            />

            {/* 단일 타래 역추적 모드일 때 상단 복귀 배너 */}
            {focusedThread ? (
              <div className="flex flex-col">
                <div className="px-4 py-2.5 bg-sky-950/30 border-b border-sky-900/50 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setFocusedThread(null)}
                    className="flex items-center gap-1.5 text-xs font-medium text-sky-300 hover:text-sky-200 transition"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>전체 타임라인으로 돌아가기</span>
                  </button>
                  <span className="text-[11px] text-neutral-500">
                    선택된 링크의 원본 타래 흐름
                  </span>
                </div>

                {focusedThread.map((post, idx) => (
                  <ThreadPostCard
                    key={post.id}
                    post={post}
                    hasNextInThread={idx < focusedThread.length - 1}
                    isHighlighted={post.id === focusPostId}
                    onReplyClick={(target) => setReplyTarget(target)}
                    onTagClick={handleTagClick}
                  />
                ))}
              </div>
            ) : isLoadingFeed ? (
              /* 초기 피드 로딩 스피너 */
              <div className="py-16 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-neutral-500" />
              </div>
            ) : threads.length === 0 ? (
              /* 빈 상태 안내 */
              <div className="py-20 px-4 text-center text-sm text-neutral-500">
                {selectedTag || selectedDate
                  ? "선택한 조건에 해당하는 기록이 없습니다."
                  : "아직 남겨진 기록이 없습니다. 첫 번째 생각을 던져보세요!"}
              </div>
            ) : (
              /* 일반 타임라인 타래 목록 */
              <div className="flex flex-col">
                {threads.map((threadGroup) =>
                  threadGroup.map((post, idx) => (
                    <ThreadPostCard
                      key={post.id}
                      post={post}
                      hasNextInThread={idx < threadGroup.length - 1}
                      isHighlighted={post.id === focusPostId}
                      onReplyClick={(target) => setReplyTarget(target)}
                      onTagClick={handleTagClick}
                    />
                  )),
                )}

                {/* 다음 페이지(이전 기록) 더 불러오기 버튼 */}
                {hasMore && (
                  <div className="p-4 flex justify-center">
                    <button
                      type="button"
                      disabled={isLoadingMore}
                      onClick={() => fetchFeed(nextCursor, true)}
                      className="px-4 py-2 rounded-full bg-neutral-900 border border-neutral-800 text-xs text-neutral-400 hover:text-neutral-100 hover:border-neutral-700 disabled:opacity-50 transition flex items-center gap-1.5"
                    >
                      {isLoadingMore && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      )}
                      <span>이전 생각 더 불러오기</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
