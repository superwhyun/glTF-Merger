/**
 * 간단한 메시지(토스트/알림) 유틸 함수
 * 개발 중에는 console.log로 대체
 */
export function showMessage(
  title: string,
  description: string,
  type: "success" | "error" = "success"
) {
  console.log(`${title}: ${description}`);
  // 실제 서비스에서는 toast 등으로 교체 가능
}