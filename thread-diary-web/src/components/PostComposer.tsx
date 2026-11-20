import {
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FC,
  type KeyboardEvent,
} from "react";
import type { PostImage, PostItem } from "../types/post";
import { CornerDownRight, ImagePlus, Loader2, X } from "lucide-react";

interface PostComposerProps {
  replyTarget?: PostItem | null; // 타래 잇기 대상 글 (없으면 새 글)
  onCancelReply?: () => void;
  onPostCreated?: () => void;
}

const PostComposer: FC<PostComposerProps> = ({
  replyTarget = null,
  onCancelReply,
  onPostCreated,
}) => {
  const [content, setContent] = useState("");
  const [uploadedImages, setUploadedImages] = useState<PostImage[]>();
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 단일 이미지 파일 서버 업로드 공통 함수
  const uploadFile = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/uploads/image", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("이미지 업로드 실패");

      const data: PostImage = await res.json();
      setUploadedImages((prev) => [...prev, data]);
    } catch (err) {
      console.error(err);
      alert("이미지 업로드 중 오류가 발생했습니다.");
    } finally {
      setIsUploading(false);
    }
  };

  // Ctrl+V / Cmd+V 클립보드 이미지 붙여넣기 핸들러
  const handlePaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault(); // 이미지 바이너리 텍스트가 붙여넣어지는 것 방지
        const file = item.getAsFile();
        if (file) {
          await uploadFile(file);
        }
      }
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      await uploadFile(file);
    }
    e.target.value = "";
  };

  const removeImage = (id: number) => {
    setUploadedImages((prev) => prev?.filter((img) => img.id != id));
  };

  const handleSubmit = async () => {
    if ((!content.trim() && uploadedImages?.length === 0) || isSubmitting)
      return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          parent_id: replyTarget ? replyTarget.id : null,
          image_ids: uploadedImages?.map((img) => img.id),
        }),
      });
      if (!res.ok) throw new Error("게시글 저장 실패");

      setContent("");
      setUploadedImages([]);
      if (onCancelReply) onCancelReply();
      onPostCreated();
    } catch (err) {
      console.error(err);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cmd+Enter 또는 Ctrl+Enter로 빠른 작성
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key == "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="p-4 border-b border-neutral-800 bg-[#101010]">
      {/* 타래 잇기 모드일 때 상단 대상 표시 배너 */}
      {replyTarget && (
        <div className="mb-2.5 flex items-center justify-between px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-neutral-400">
          <div className="flex items-center gap-1.5 truncate">
            <CornerDownRight className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="truncate">
              이전 생각에 타래 잇기: "{replyTarget.content.slice(0, 40)}..."
            </span>
          </div>
          {onCancelReply && (
            <button
              type="button"
              onClick={onCancelReply}
              className="text-neutral-500 hover:text-neutral-200 ml-2"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          rows={3}
          placeholder={
            replyTarget
              ? "이어지는 생각을 남겨보세요 (Ctrl+V로 이미지 붙여넣기)"
              : "무슨 생각을 하고 있나요? #태그나 링크를 자유롭게 적어보세요"
          }
          className="w-full bg-transparent text-[15px] text-neutral-100 placeholder-neutral-600 resize-none focus:outline-none leading-relaxed"
        />

        {/* 업로드된 이미지 미리보기 */}
        {uploadedImages?.length > 0 && (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {uploadedImages?.map((img) => (
              <div key={img.id} className="relative shrink-0 group">
                <img
                  src={img.url}
                  alt="업로드 미리보기"
                  className="h-24 w-24 object-cover rounded-lg border border-neutral-800"
                />
                <button
                  type="button"
                  onClick={() => removeImage(img.id)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/75 text-neutral-300 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 하단 툴바 */}
        <div className="mt-2 pt-2 flex items-center justify-between border-t border-neutral-800/60">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/70 transition flex items-center gap-1.5 text-xs"
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
              ) : (
                <ImagePlus className="w-4 h-4" />
              )}
              <span>이미지</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-neutral-600 hidden sm:inline">
              Cmd/Ctrl + Enter
            </span>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                (!content.trim() && uploadedImages?.length === 0) ||
                isSubmitting
              }
              className="px-4 py-1.5 rounded-full bg-neutral-100 text-neutral-950 text-xs font-semibold hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              {isSubmitting ? "저장 중..." : "기록하기"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostComposer;
