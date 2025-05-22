"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Loader2, Play } from "lucide-react"
import { Button } from "@/components/ui/button"

interface VRMADropZoneProps {
  onAnimationLoaded: (file: File, animationName: string) => void
  onAnimationApply: () => void
  isVRMLoaded: boolean
  loadedAnimationName: string | null
  disabled?: boolean
}

export function VRMADropZone({
  onAnimationLoaded,
  onAnimationApply,
  isVRMLoaded,
  loadedAnimationName,
  disabled = false
}: VRMADropZoneProps) {
  const [isLoading, setIsLoading] = useState(false)

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (disabled) return;
      console.log("🎬 VRMA onDrop 시작", { filesCount: acceptedFiles.length })
      if (acceptedFiles.length === 0) {
        console.warn("⚠️ 업로드된 파일이 없습니다")
        return
      }

      const file = acceptedFiles[0]
      console.log("📁 처리할 파일:", { name: file.name, size: file.size, type: file.type })
      
      setIsLoading(true)

      try {
        // 파일 확장자 확인
        const extension = file.name.split(".").pop()?.toLowerCase()
        console.log(`업로드된 파일: ${file.name}, 확장자: ${extension}, 크기: ${file.size} 바이트`)
        
        // VRMA 파일은 .vrma 또는 .glb 확장자를 가질 수 있음
        if (extension !== "vrma" && extension !== "glb") {
          console.error(`지원하지 않는 파일 형식: ${extension}`)
          throw new Error(`VRMA 파일(.vrma 또는 .glb)만 지원합니다. (업로드된 파일: .${extension})`)
        }

        console.log(`✅ VRMA 파일 확인 완료: ${file.name} (.${extension})`)
        
        // 파일 내용 검증
        const arrayBuffer = await file.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        const fileHeader = uint8Array.slice(0, 4)
        console.log("파일 헤더:", fileHeader)
        
        // GLB 매직 넘버 확인 (0x46546C67 = "glTF")
        if (fileHeader[0] !== 0x67 || fileHeader[1] !== 0x6C || fileHeader[2] !== 0x54 || fileHeader[3] !== 0x46) {
          console.warn("GLB 헤더가 아닌 파일입니다. 하지만 시도해봅니다.")
        } else {
          console.log("✅ 유효한 GLB 헤더 확인됨")
        }
        
        // 애니메이션 이름 추출 (파일명에서 확장자 제거)
        const animationName = file.name.replace(/\.(vrma|glb)$/i, "")
        console.log(`✅ 애니메이션 이름: ${animationName}`)
        
        console.log("🔄 onAnimationLoaded 콜백 호출 중...")
        console.log("콜백 함수 타입:", typeof onAnimationLoaded)
        console.log("VRM 로드 상태:", isVRMLoaded)
        
        onAnimationLoaded(file, animationName)
        console.log("✅ onAnimationLoaded 콜백 완료")
      } catch (error) {
        console.error("❌ VRMA 로딩 오류:", error)
        console.error("에러 스택:", error instanceof Error ? error.stack : "No stack")
        alert(error instanceof Error ? error.message : "VRMA 파일 로딩에 실패했습니다.")
      } finally {
        console.log("🔄 로딩 상태 해제")
        setIsLoading(false)
      }
    },
    [onAnimationLoaded, isVRMLoaded],
  )

  // 가장 단순한 드롭존 설정 - 모든 파일 허용
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    multiple: false,
    // accept 속성 완전 제거
  })

  console.log("VRMADropZone 렌더링:", { isVRMLoaded, loadedAnimationName, isLoading })

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          isDragActive 
            ? "border-green-500 bg-green-50" 
            : isVRMLoaded 
              ? "border-green-300 hover:border-green-500" 
              : "border-gray-200 bg-gray-50"
        } ${!isVRMLoaded ? "opacity-50 pointer-events-none" : ""}`}
      >
        <input {...getInputProps()} />
        {isLoading ? (
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-green-600" />
            <p className="mt-1 text-sm text-gray-600">VRMA 로딩 중...</p>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-600">
              {!isVRMLoaded 
                ? "먼저 VRM 모델을 로드해주세요"
                : isDragActive
                  ? "VRMA 파일을 여기에 놓으세요..."
                  : "VRMA 애니메이션 파일(.vrma 또는 .glb)을 드롭하세요"
              }
            </p>
            {loadedAnimationName && (
              <p className="text-xs text-green-600 mt-1">
                로드됨: {loadedAnimationName}
              </p>
            )}
            {/* 디버그 정보 */}
            <p className="text-xs text-gray-400 mt-1">
              디버그: VRM={isVRMLoaded ? '✅' : '❌'} | 상태={isLoading ? '로딩중' : '대기중'}
            </p>
          </div>
        )}
      </div>
      
      {loadedAnimationName && isVRMLoaded && (
        <Button 
          onClick={onAnimationApply}
          className="w-full"
          size="sm"
        >
          <Play className="h-4 w-4 mr-2" />
          애니메이션 적용
        </Button>
      )}
    </div>
  )
}
