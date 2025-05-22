"use client"

import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { useState } from "react"
import { exportModel } from "@/lib/model-exporter"
import { useToast } from "@/components/ui/use-toast"
import * as THREE from "three"
// import { GLTFDocumentManager } from "@/lib/gltf-document-manager"

interface ModelDownloadButtonProps {
  scene: THREE.Scene | null
  fileName: string
  animations?: THREE.AnimationClip[]
  disabled?: boolean
  modelStructure?: any // 모델 구조에서 애니메이션 정보를 가져오기 위해 추가
  vrmData?: any // VRM 메타데이터 및 설정 - VRM 파일 내보내기용
  isVRM?: boolean // VRM 모델인지 여부
  documentManager?: any | null // GLTFDocumentManager 참조 (임시 any)
}

export function ModelDownloadButton({ 
  scene, 
  fileName, 
  animations = [], 
  disabled = false, 
  modelStructure,
  vrmData,
  isVRM = false,
  documentManager
}: ModelDownloadButtonProps) {
  const [isExporting, setIsExporting] = useState(false)
  const { toast } = useToast()

  const handleDownload = async () => {
    if (!scene && !documentManager) {
      toast({
        title: "내보내기 실패",
        description: "모델이 로드되지 않았습니다.",
        variant: "destructive",
      })
      return
    }

    setIsExporting(true)

    try {
      // 적절한 확장자 처리
      let exportFileName = fileName;
      
      if (isVRM) {
        if (!fileName.toLowerCase().endsWith(".vrm")) {
          exportFileName = fileName.replace(/\.[^/.]+$/, "") + ".vrm";
        }
        console.log("VRM 내보내기 시작:", exportFileName);
      } else {
        if (!fileName.toLowerCase().endsWith(".glb")) {
          exportFileName = fileName.replace(/\.[^/.]+$/, "") + ".glb";
        }
        console.log("GLB 내보내기 시작:", exportFileName);
      }

      // GLTFDocumentManager가 있으면 우선 사용
      if (documentManager) {
        console.log("🟢 [DOWNLOAD] GLTFDocumentManager를 사용한 내보내기 - gltf-transform Document 기반");
        console.log("🟢 [DOWNLOAD] documentManager 존재:", !!documentManager);
        console.log("🟢 [DOWNLOAD] documentManager.getDocument():", documentManager.getDocument());
        
        const arrayBuffer = await documentManager.exportToGLB();
        
        console.log("🟢 [DOWNLOAD] gltf-transform에서 내보내기 완료, 크기:", arrayBuffer.byteLength, "bytes");
        
        // 다운로드 실행
        const blob = new Blob([arrayBuffer], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = exportFileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);

        toast({
          title: "내보내기 성공",
          description: `${exportFileName} 파일이 다운로드되었습니다. (gltf-transform 사용)`,
        });
      } else {
        throw new Error("GLTFDocumentManager가 없습니다. 모델을 다시 로드해주세요.");
      }

    } catch (error) {
      console.error("내보내기 오류:", error);
      toast({
        title: "내보내기 실패",
        description: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
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
          {isVRM ? "VRM 다운로드" : "GLB 다운로드"}
        </>
      )}
    </Button>
  )
}
