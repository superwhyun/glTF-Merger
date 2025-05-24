import { useState, useCallback, useRef } from "react";
import * as THREE from "three";
import type { VRM } from "@pixiv/three-vrm";
import { deleteNodeFromStructure } from "@/lib/model-utils";
import { loadVRMAAnimation, createAnimationClipFromVRMA, isVRMACompatible } from "@/lib/vrma-utils";
import { loadAnimation, remapAnimationTracksToModelBones } from "@/lib/animation-utils";
import { showMessage } from "@/lib/showMessage";
import { logFBXBoneNames, logGLBBoneNames } from "@/lib/bone-mapping-utils";

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
  const [hasModel, setHasModel] = useState<boolean>(false); // 일반 모델 로드 상태
  const [targetModel, setTargetModel] = useState<THREE.Object3D | null>(null); // 타겟 모델 객체
  const [vrmaFile, setVRMAFile] = useState<File | null>(null);
  const [vrmaName, setVRMAName] = useState<string | null>(null);
  
  // DocumentManager 참조 저장
  const documentManagerRef = useRef<any>(null);

  // DocumentManager 설정 함수
  const setDocumentManager = useCallback((manager: any) => {
    documentManagerRef.current = manager;
    console.log(`${side} DocumentManager 설정됨:`, !!manager);
  }, [side]);

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
    setHasModel(!!vrmObj); // VRM이 로드되면 모델 로드 상태도 true
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

  // 일반 모델 로드 핸들러 (GLB/GLTF)
  const handleModelLoaded = useCallback((modelObject?: THREE.Object3D) => {
    setHasModel(true);
    if (modelObject) {
      setTargetModel(modelObject);
      console.log(`${side === "left" ? "왼쪽" : "오른쪽"} 타겟 모델 설정됨:`, modelObject.name);
    }
    console.log(`${side === "left" ? "왼쪽" : "오른쪽"} 일반 모델 로드됨`);
  }, [side]);

  // VRMA 애니메이션 로드 핸들러
  const handleVRMALoaded = useCallback((file: File, animationName: string) => {
    setVRMAFile(file);
    setVRMAName(animationName);
    console.log(`✅ ${side === "left" ? "왼쪽" : "오른쪽"} VRMA 상태 업데이트 완료`);
  }, [side]);

  // 범용 애니메이션 적용 핸들러 (VRM과 일반 모델 모두 지원)
  const handleVRMAApply = useCallback(async () => {
    if (!hasModel || !vrmaFile) {
      const modelType = vrm ? "VRM 모델" : "모델";
      const fileType = vrm ? "VRMA 파일" : "애니메이션 파일";
      showMessage("애니메이션 적용 실패", `${modelType}과 ${fileType}이 모두 필요합니다.`, "error");
      return;
    }

    // VRM 모델인 경우에만 호환성 확인
    if (vrm && !isVRMACompatible(vrm)) {
      showMessage("호환성 오류", "이 VRM 모델은 VRMA 애니메이션과 호환되지 않습니다.", "error");
      return;
    }

    try {
      console.log(`${side} 애니메이션 적용 시작 - 모델타입: ${vrm ? 'VRM' : 'GLB'}`);
      
      // 범용 애니메이션 로더 사용
      const targetForAnimation = vrm || targetModel;
      console.log(`타겟 모델:`, targetForAnimation ? '있음' : '없음');
      
      let animationClips = await loadAnimation(vrmaFile, targetForAnimation || undefined);

      // Print first bone name of each animation clip, if present
      animationClips.forEach(clip => {
        if (clip.tracks && clip.tracks.length > 0) {
          const trackName = clip.tracks[0].name;
          const firstBoneName = typeof trackName === "string" ? trackName.split(".")[0] : "(unknown)";
          console.log(`[clip bone]`, clip.name || '(no clip name)', '-', firstBoneName);
        }
      });

      // FBX 파일 확장자 확인
      const fileExtension = vrmaFile.name.split('.').pop()?.toLowerCase();

      // // Remap animation tracks to model bones for GLB/GLTF models only (not VRM and not FBX)
      // if (!vrm && fileExtension !== "fbx") {
      //   animationClips.forEach(clip => remapAnimationTracksToModelBones(clip, targetForAnimation));
      // }
      logFBXBoneNames(animationClips)

      

      if (animationClips.length > 0) {
        console.log(`${side} ${animationClips.length}개 AnimationClip 생성 완료`);
        
        // 1. 모델 구조에 애니메이션 추가
        setModel(prev => {
          const currentAnimations = prev.structure?.animations || [];
          const updatedStructure = {
            ...prev.structure,
            animations: Array.isArray(currentAnimations)
              ? [...currentAnimations, ...animationClips]
              : animationClips,
          };
          
          console.log(`${side} 구조 업데이트됨, 총 애니메이션:`, updatedStructure.animations.length);
          return { ...prev, structure: updatedStructure };
        });
        
        // 2. DocumentManager가 있다면 Document에도 애니메이션 추가
        if (documentManagerRef.current) {
          try {
            console.log(`${side} DocumentManager를 통해 Document에 애니메이션 추가 시도`);
            
            // 각 애니메이션 클립을 Document에 추가
            for (const animationClip of animationClips) {
              const success = await documentManagerRef.current.addAnimation(animationClip);
              if (success) {
                console.log(`${side} Document에 애니메이션 "${animationClip.name}" 추가 성공`);
              } else {
                console.warn(`${side} Document에 애니메이션 "${animationClip.name}" 추가 실패`);
              }
            }
            
            // Document 변경 후 새로운 URL 생성하여 트리 업데이트 유도
            try {
              const updatedUrl = await documentManagerRef.current.getUpdatedModelURL();
              console.log(`${side} Document URL 업데이트됨:`, updatedUrl);
              
              setModel(prev => ({ 
                ...prev, 
                url: updatedUrl,
                structure: { ...prev.structure, _forceUpdate: Date.now() }
              }));
            } catch (urlError) {
              console.warn(`${side} Document URL 업데이트 실패:`, urlError);
            }
          } catch (docError) {
            console.warn(`${side} Document 애니메이션 추가 중 오류:`, docError);
          }
        } else {
          console.warn(`${side} DocumentManager가 없어서 Document 동기화 불가`);
        }

        const modelType = vrm ? "VRM" : "GLB";
        showMessage("애니메이션 적용 성공", `${modelType} 모델에 ${vrmaName} 애니메이션 ${animationClips.length}개가 적용되었습니다.`);
      } else {
        showMessage("애니메이션 적용 실패", "유효한 애니메이션을 찾을 수 없습니다.", "error");
      }
    } catch (error) {
      console.error(`${side} 애니메이션 적용 오류:`, error);
      showMessage("애니메이션 적용 실패", error instanceof Error ? error.message : "알 수 없는 오류", "error");
    }
  }, [hasModel, vrm, vrmaFile, vrmaName, side]);

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
    hasModel,
    setHasModel,
    targetModel,
    setTargetModel,
    vrmaFile,
    setVRMAFile,
    vrmaName,
    setVRMAName,
    documentManagerRef,
    setDocumentManager,
    handleDelete,
    handleVRMLoaded,
    handleModelLoaded,
    handleVRMALoaded,
    handleVRMAApply,
    handleAnimationsLoaded,
  };
}