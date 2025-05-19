"use client"

import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { useState } from "react"
import { exportModelToGLB } from "@/lib/model-exporter"
import { useToast } from "@/components/ui/use-toast"
import * as THREE from "three"

interface ModelDownloadButtonProps {
  scene: THREE.Scene | null
  fileName: string
  animations?: THREE.AnimationClip[]
  disabled?: boolean
  modelStructure?: any // 모델 구조에서 애니메이션 정보를 가져오기 위해 추가
}

export function ModelDownloadButton({ scene, fileName, animations = [], disabled = false, modelStructure }: ModelDownloadButtonProps) {
  const [isExporting, setIsExporting] = useState(false)
  const { toast } = useToast()

  const handleDownload = async () => {
    if (!scene) {
      toast({
        title: "내보내기 실패",
        description: "모델이 로드되지 않았습니다.",
        variant: "destructive",
      })
      return
    }

    // 모델 구조에서 애니메이션 정보 추출 (우선순위: modelStructure > props)
    const exportAnimations = (modelStructure?.animations && Array.isArray(modelStructure.animations)) 
      ? modelStructure.animations 
      : animations;

    // 씬에 모델이 있는지 확인
    let hasModel = false
    let objectCount = 0
    const systemTypes = [
      "GridHelper", "DirectionalLight", "AmbientLight", "HemisphereLight", 
      "PointLight", "SpotLight", "CameraHelper"
    ];

    scene.traverse((object) => {
      objectCount++
      const isSystemObject = systemTypes.includes(object.type) || 
                            object.name.includes("Helper") || 
                            object.name.includes("Grid");
      
      if (!isSystemObject && 
          (object instanceof THREE.Mesh || 
           (object instanceof THREE.Group && object.parent === scene))) {
        hasModel = true
      }
    })

    console.log(`내보내기 전 분석: 총 객체 ${objectCount}개, 모델 존재: ${hasModel}, 애니메이션 ${exportAnimations.length}개`)

    if (!hasModel) {
      toast({
        title: "내보내기 실패",
        description: "씬에 내보낼 모델이 없습니다.",
        variant: "destructive",
      })
      return
    }

    setIsExporting(true)

    try {
      console.log("GLB 내보내기 시작:", fileName)
      console.log("사용할 애니메이션:", exportAnimations.map(a => a.name))
      
      exportModelToGLB(scene, fileName, exportAnimations)

      toast({
        title: "내보내기 성공",
        description: `${fileName} 파일이 다운로드되었습니다.`,
      })
    } catch (error) {
      console.error("내보내기 오류:", error)
      toast({
        title: "내보내기 실패",
        description: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDownload}
      disabled={disabled || isExporting || !scene}
      className="flex items-center gap-1"
    >
      {isExporting ? (
        <span className="animate-pulse">내보내는 중...</span>
      ) : (
        <>
          <Download className="h-4 w-4" />
          GLB 다운로드
        </>
      )}
    </Button>
  )
}
