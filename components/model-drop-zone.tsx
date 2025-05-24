"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { parseGLTF } from "@/lib/model-parser"
import { Loader2 } from "lucide-react"

interface ModelDropZoneProps {
  onModelLoaded: (file: File | null, structure: any | null, url: string | null, error: string | null) => void
}

export function ModelDropZone({ onModelLoaded }: ModelDropZoneProps) {
  const [isLoading, setIsLoading] = useState(false)

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return

      const file = acceptedFiles[0]
      setIsLoading(true)

      try {
        // 파일 확장자 확인
        const extension = file.name.split(".").pop()?.toLowerCase()
        if (extension !== "glb" && extension !== "vrm") {
          throw new Error("GLB 또는 VRM 파일만 지원합니다.")
        }

        console.log(`파일 로드 시작: ${file.name} (${file.size} 바이트)`)

        // 파일 URL 생성
        const url = URL.createObjectURL(file)

        // 파일 구조 파싱 --> Legacy Code ... 현재 안 쓰임..
        // console.log("파일 구조 파싱 중...")
        // const structure = await parseGLTF(file)
        // console.log("파일 구조 파싱 완료")

        // 모델에 애니메이션이 있는지 확인
        // const hasAnimations = structure.animations && Object.keys(structure.animations).length > 0
        // console.log(`애니메이션 ${hasAnimations ? "발견" : "없음"}`)

        // if (hasAnimations) {
        //   console.log("애니메이션 목록:", Object.keys(structure.animations))
        // }

        onModelLoaded(file, null, url, null)
      } catch (error) {
        console.error("모델 로딩 오류:", error)
        onModelLoaded(file, null, null, error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.")
      } finally {
        setIsLoading(false)
      }
    },
    [onModelLoaded],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "model/gltf-binary": [".glb", ".vrm"],
    },
    maxFiles: 1,
  })

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
        isDragActive ? "border-primary bg-primary/5" : "border-gray-300 hover:border-primary/50"
      }`}
    >
      <input {...getInputProps()} />
      {isLoading ? (
        <div className="flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-2">모델 로딩 중...</p>
        </div>
      ) : (
        <div>
          <p className="text-sm text-gray-500">
            {isDragActive
              ? "파일을 여기에 놓으세요..."
              : "GLB 또는 VRM 파일을 드래그 앤 드롭하거나 클릭하여 선택하세요"}
          </p>
        </div>
      )}
    </div>
  )
}
