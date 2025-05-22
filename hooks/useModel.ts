import { useState, useCallback } from "react";
import * as THREE from "three";
import type { VRM } from "@pixiv/three-vrm";
import { deleteNodeFromStructure } from "../lib/model-utils";
import { loadVRMAAnimation, createAnimationClipFromVRMA, isVRMACompatible } from "../lib/vrma-utils";
import { showMessage } from "../lib/showMessage";

type Side = "left" | "right";

export function useModel(historyManager: any, side: Side) {
  const [model, setModel] = useState<{
    file: File | null;
    structure: any;
    url: string | null;
    error: string | null;
  }>({
    file: null,
    structure: null,
    url: null,
    error: null,
  });

  const [vrm, setVRM] = useState<VRM | null>(null);
  const [vrmaFile, setVRMAFile] = useState<File | null>(null);
  const [vrmaName, setVRMAName] = useState<string | null>(null);

  // 삭제 핸들러
  const handleDelete = (path: string[]) => {
    if (!model.structure) return;

    const prevState = model.structure;
    const result = deleteNodeFromStructure(model.structure, path);

    if (result.success) {
      historyManager.addAction({
        type: "delete",
        targetSide: side,
        path,
        prevState,
        newState: result.result,
        description: `모델 ${side === "left" ? "A" : "B"}에서 '${path[path.length - 1] || "root"}' 노드 삭제`,
      });

      setModel({ ...model, structure: result.result });
      showMessage("노드 삭제", result.message);
    } else {
      showMessage("삭제 실패", result.message, "error");
    }
  };

  // VRM 로드 핸들러
  const handleVRMLoaded = useCallback((vrmObj: VRM | null, vrmData?: any) => {
    setVRM(vrmObj);
    console.log(`${side === "left" ? "왼쪽" : "오른쪽"} VRM 로드됨:`, vrmObj ? "VRM 모델" : "일반 모델");
    
    // VRM 메타데이터 모델 구조에 추가
    if (vrmObj && vrmData) {
      setModel(prev => ({
        ...prev,
        structure: {
          ...prev.structure,
          vrmMetadata: vrmData
        }
      }));
    }
  }, [side]);

  // VRMA 애니메이션 로드 핸들러
  const handleVRMALoaded = useCallback((file: File, animationName: string) => {
    setVRMAFile(file);
    setVRMAName(animationName);
    console.log(`✅ ${side === "left" ? "왼쪽" : "오른쪽"} VRMA 상태 업데이트 완료`);
  }, [side]);

  // VRMA 애니메이션 적용 핸들러
  const handleVRMAApply = useCallback(async () => {
    if (!vrm || !vrmaFile) {
      showMessage("애니메이션 적용 실패", "VRM 모델과 VRMA 파일이 모두 필요합니다.", "error");
      return;
    }

    if (!isVRMACompatible(vrm)) {
      showMessage("호환성 오류", "이 VRM 모델은 VRMA 애니메이션과 호환되지 않습니다.", "error");
      return;
    }

    try {
      const vrmaAnimation = await loadVRMAAnimation(vrmaFile);

      if (vrmaAnimation) {
        const animationClip = await createAnimationClipFromVRMA(vrmaAnimation, vrm);

        if (animationClip) {
          setModel(prev => {
            const currentAnimations = prev.structure?.animations || [];
            return {
              ...prev,
              structure: {
                ...prev.structure,
                animations: Array.isArray(currentAnimations)
                  ? [...currentAnimations, animationClip]
                  : [animationClip],
              },
            };
          });

          showMessage("애니메이션 적용 성공", `${vrmaName} 애니메이션이 적용되었습니다.`);
        } else {
          showMessage("애니메이션 적용 실패", "AnimationClip 생성에 실패했습니다.", "error");
        }
      }
    } catch (error) {
      showMessage("애니메이션 적용 실패", error instanceof Error ? error.message : "알 수 없는 오류", "error");
    }
  }, [vrm, vrmaFile, vrmaName, side]);

  // 애니메이션 로드 핸들러
  const handleAnimationsLoaded = useCallback((animations: THREE.AnimationClip[]) => {
    setModel(prev => ({
      ...prev,
      structure: {
        ...prev.structure,
        animations: animations,
      },
    }));
  }, []);

  return {
    model,
    setModel,
    vrm,
    setVRM,
    vrmaFile,
    setVRMAFile,
    vrmaName,
    setVRMAName,
    handleDelete,
    handleVRMLoaded,
    handleVRMALoaded,
    handleVRMAApply,
    handleAnimationsLoaded,
  };
}