"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Loader2, Play } from "lucide-react"
import { Button } from "@/components/ui/button"

interface AnimationDropZoneProps {
  onAnimationLoaded: (file: File, animationName: string) => void
  onAnimationApply: () => void
  isModelLoaded: boolean
  loadedAnimationName: string | null
  disabled?: boolean
  modelType?: "VRM" | "GLB" | "GLTF"
}

export function AnimationDropZone({
  onAnimationLoaded,
  onAnimationApply,
  isModelLoaded,
  loadedAnimationName,
  disabled = false,
  modelType = "GLB"
}: AnimationDropZoneProps) {
  const [isLoading, setIsLoading] = useState(false)

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (disabled) return;
      console.log("🎬 Animation onDrop 시작", { filesCount: acceptedFiles.length, modelType })
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
        
        // 지원하는 애니메이션 파일 형식
        const supportedExtensions = ["vrma", "glb", "gltf", "fbx"]
        
        if (!extension || !supportedExtensions.includes(extension)) {
          console.error(`지원하지 않는 파일 형식: ${extension}`)
          throw new Error(`지원하는 애니메이션 파일 형식: ${supportedExtensions.join(", ")} (업로드된 파일: .${extension})`)
        }

        console.log(`✅ 애니메이션 파일 확인 완료: ${file.name} (.${extension})`)
        
        // 애니메이션 이름 추출 (파일명에서 확장자 제거)
        const animationName = file.name.replace(/\.(vrma|glb|gltf|fbx)$/i, "")
        console.log(`✅ 애니메이션 이름: ${animationName}`)
        
        console.log("🔄 onAnimationLoaded 콜백 호출 중...")
        onAnimationLoaded(file, animationName)
        console.log("✅ onAnimationLoaded 콜백 완료")
      } catch (error) {
        console.error("❌ 애니메이션 로딩 오류:", error)
        alert(error instanceof Error ? error.message : "애니메이션 파일 로딩에 실패했습니다.")
      } finally {
        console.log("🔄 로딩 상태 해제")
        setIsLoading(false)
      }
    },
    [onAnimationLoaded, isModelLoaded, modelType],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    multiple: false,
    accept: {
      'application/octet-stream': ['.fbx', '.glb', '.vrma'],
      'model/gltf+json': ['.gltf'],
      'model/gltf-binary': ['.glb'],
    }
  })

  const getPlaceholderText = () => {
    if (!isModelLoaded) {
      return `먼저 ${modelType} 모델을 로드해주세요`
    }
    
    if (isDragActive) {
      return "애니메이션 파일을 여기에 놓으세요..."
    }
    
    const supportedFormats = modelType === "VRM" 
      ? "VRMA, GLB, FBX" 
      : "FBX, GLB, GLTF"
    
    return `애니메이션 파일(${supportedFormats})을 드롭하세요`
  }

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          isDragActive 
            ? "border-blue-500 bg-blue-50" 
            : isModelLoaded 
              ? "border-blue-300 hover:border-blue-500" 
              : "border-gray-200 bg-gray-50"
        } ${!isModelLoaded ? "opacity-50 pointer-events-none" : ""}`}
      >
        <input {...getInputProps()} />
        {isLoading ? (
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <p className="mt-1 text-sm text-gray-600">애니메이션 로딩 중...</p>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-600">
              {getPlaceholderText()}
            </p>
            {loadedAnimationName && (
              <p className="text-xs text-blue-600 mt-1">
                로드됨: {loadedAnimationName}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {modelType}={isModelLoaded ? '✅' : '❌'} | 상태={isLoading ? '로딩중' : '대기중'}
            </p>
          </div>
        )}
      </div>
      
      {loadedAnimationName && isModelLoaded && (
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
