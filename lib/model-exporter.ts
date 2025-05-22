import * as THREE from "three"
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter"
import { VRMUtils } from "@pixiv/three-vrm"

/**
 * VRM / GLB 형식을 자동 감지하여 적절한 파일로 내보내는 함수
 */
export function exportModel(scene: THREE.Scene, fileName: string, animations: THREE.AnimationClip[] = [], vrmData?: any): void {
  // VRM 모델인지 확인
  const hasVRM = vrmData != null;
  
  // 확장자에 따라 적절한 내보내기 함수 호출
  if (hasVRM) {
    console.log("VRM 모델 감지됨, VRM 형식으로 내보내기 시도");
    exportModelToVRM(scene, fileName, animations, vrmData);
  } else {
    console.log("일반 모델, GLB 형식으로 내보내기");
    exportModelToGLB(scene, fileName, animations);
  }
}

/**
 * VRM 모델을 VRM 파일로 내보내는 함수
 */
export function exportModelToVRM(scene: THREE.Scene, fileName: string, animations: THREE.AnimationClip[] = [], vrmData: any): void {
  console.log("VRM 내보내기 시작: 원본 VRM 메타데이터 보존");
  
  const exportableRoot = scene.children.find(obj => obj.name === 'exportableModel');
  if (!exportableRoot) {
    throw new Error('"exportableModel" 객체를 찾을 수 없습니다. 씬 루트에 존재해야 합니다.');
  }

  const exportScene = new THREE.Scene();
  const clonedExportable = exportableRoot.clone(true);

  clonedExportable.traverse((child) => {
    if (child.type === "Bone") {
      (child as any).isBone = true;
    }
    if (child instanceof THREE.SkinnedMesh && child.skeleton) {
      child.skeleton.bones.forEach(bone => {
        (bone as any).isBone = true;
      });
    }
  });

  exportScene.add(clonedExportable);
  
  // 애니메이션 처리
  const exportAnimations: THREE.AnimationClip[] = [];
  
  if (animations && animations.length > 0) {
    console.log(`애니메이션 ${animations.length}개 처리 중...`);
    
    // 내보낼 객체들의 이름 수집
    const exportObjectNames = new Set<string>();
    exportScene.traverse((obj) => {
      if (obj.name) exportObjectNames.add(obj.name);
    });
    
    for (const clip of animations) {
      // 애니메이션 클립을 완전히 복사
      const tracks: THREE.KeyframeTrack[] = [];
      
      for (const track of clip.tracks) {
        // 트랙의 대상이 내보낼 객체에 존재하는지 확인
        const targetName = track.name.split('.')[0];
        
        if (exportObjectNames.has(targetName) || targetName === '') {
          // KeyframeTrack도 복사
          const clonedTrack = track.clone();
          tracks.push(clonedTrack);
        } else {
          console.warn(`애니메이션 트랙 스킵: ${track.name} (대상 객체 없음)`);
        }
      }
      
      if (tracks.length > 0) {
        const exportClip = new THREE.AnimationClip(clip.name, clip.duration, tracks);
        exportAnimations.push(exportClip);
        console.log(`애니메이션 "${clip.name}" 포함됨: ${tracks.length}/${clip.tracks.length} 트랙`);
      }
    }
  }

  // VRM 메타데이터 및 확장 데이터 설정
  const extraData = {
    userData: {
      vrmMetaData: vrmData.meta,
      vrmHumanoid: vrmData.humanoid
    }
  };
  
  // 내보내기 상태 확인
  let meshCount = 0;
  let boneCount = 0;
  let animationCount = exportAnimations.length;
  
  exportScene.traverse((obj) => {
    if (obj instanceof THREE.Mesh) meshCount++;
    if (obj.type === "Bone" || (obj instanceof THREE.Bone)) {
      boneCount++;
      // 한 번 더 확인하여 isBone 플래그 설정
      (obj as any).isBone = true;
    }
  });
  
  console.log(`내보내기 준비 완료:`);
  console.log(`- 메시: ${meshCount}개`);
  console.log(`- 본: ${boneCount}개`);
  console.log(`- 애니메이션: ${animationCount}개`);
  console.log(`- VRM 메타데이터:`, vrmData.meta);
  
  // GLTFExporter 옵션 - VRM 확장 활성화
  const exportOptions = {
    binary: true,
    animations: exportAnimations,
    includeCustomExtensions: true,    // VRM 등 커스텀 확장 포함 - 핵심 옵션!
    onlyVisible: false,               // 숨겨진 객체도 포함
    truncateDrawRange: false,         // 드로우 범위 유지
    embedImages: true,                // 텍스처를 파일에 임베드
    forcePowerOfTwoTextures: false,   // 텍스처 크기 강제 변경 안 함
    maxTextureSize: 4096,             // 최대 텍스처 크기
    trs: false,                       // 변환을 분해하지 않고 매트릭스 그대로 사용
  };
  
  // 파일명에 .vrm 확장자 보장
  let exportFileName = fileName;
  if (!fileName.toLowerCase().endsWith(".vrm")) {
    exportFileName = fileName.replace(/\.[^/.]+$/, "") + ".vrm";
  }
  
  // VRM 내보내기 실행
  const exporter = new GLTFExporter();
  
  // userData를 통해 VRM 메타데이터 전달
  exportScene.userData = { ...exportScene.userData, ...extraData.userData };
  
  exporter.parse(
    exportScene,
    (buffer) => {
      const arrayBuffer = buffer as ArrayBuffer;
      const sizeMB = (arrayBuffer.byteLength / 1024 / 1024).toFixed(2);
      console.log(`✅ VRM 생성 성공: ${sizeMB}MB`);
      
      // 다운로드 실행
      const blob = new Blob([arrayBuffer], { type: "model/gltf-binary" });
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
    },
    (error) => {
      console.error("VRM 내보내기 실패:", error);
      alert("VRM 내보내기 실패: " + (error instanceof Error ? error.message : error));
    },
    exportOptions
  );
}
export function exportModelToGLB(scene: THREE.Scene, fileName: string, animations: THREE.AnimationClip[] = []): void {
  /*
  console.log("내보내기 시작: 원본 구조 완전 보존 방식");
  
  // 원본 모델 객체 찾기 (시스템 객체 제외)
  const systemTypes = [
    "GridHelper", "DirectionalLight", "AmbientLight", "HemisphereLight", 
    "PointLight", "SpotLight", "CameraHelper", "SpotLightHelper", "DirectionalLightHelper"
  ];
  
  const modelObjects: THREE.Object3D[] = [];
  
  scene.traverse((object) => {
    // 시스템 객체가 아니고 씬의 직접 자식인 경우만 수집
    if (object.parent === scene && !systemTypes.includes(object.type)) {
      const isSystemObject = object.name.includes("Helper") || 
                            object.name.includes("Grid") ||
                            object.name.includes("Light");
      
      if (!isSystemObject) {
        modelObjects.push(object);
        console.log(`모델 객체 발견: ${object.type} "${object.name}"`);
      }
    }
  });
  
  if (modelObjects.length === 0) {
    throw new Error("내보낼 모델이 씬에 없습니다. 모델을 먼저 로드해주세요.");
  }
  
  // **핵심**: 원본과 동일한 구조를 가진 새 씬 생성
  const exportScene = new THREE.Scene();
  
  // 기본 조명 추가 (표준 환경)
  const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
  exportScene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
  directionalLight.position.set(1, 1, 1);
  directionalLight.castShadow = false; // 그림자 비활성화로 성능 향상
  exportScene.add(directionalLight);

  // 모델 객체들을 깊은 복제하여 exportScene에 추가 (원본 씬/렌더링/Scene Graph 보존)
  for (const modelObject of modelObjects) {
    // 깊은 복제를 통해 exportScene에 추가
    const clonedModel = modelObject.clone(true);
    
    // 모든 Bone 객체에 isBone 플래그 명시적 설정 (GLTFLoader 호환성 이슈 해결)
    clonedModel.traverse((child) => {
      if (child.type === "Bone") {
        (child as any).isBone = true;
      }
      
      // SkinnedMesh의 경우 본 참조 재설정
      if (child instanceof THREE.SkinnedMesh && child.skeleton) {
        // 각 본에 isBone 플래그 설정
        child.skeleton.bones.forEach(bone => {
          (bone as any).isBone = true;
        });
      }
    });
    
    exportScene.add(clonedModel);
  }
  
  // 애니메이션 처리 (Three.js 객체를 그대로 복사)
  const exportAnimations: THREE.AnimationClip[] = [];
  
  if (animations && animations.length > 0) {
    console.log(`애니메이션 ${animations.length}개 처리 중...`);
    
    // 내보낼 객체들의 이름 수집
    const exportObjectNames = new Set<string>();
    exportScene.traverse((obj) => {
      if (obj.name) exportObjectNames.add(obj.name);
    });
    
    for (const clip of animations) {
      // 애니메이션 클립을 완전히 복사
      const tracks: THREE.KeyframeTrack[] = [];
      
      for (const track of clip.tracks) {
        // 트랙의 대상이 내보낼 객체에 존재하는지 확인
        const targetName = track.name.split('.')[0];
        
        if (exportObjectNames.has(targetName) || targetName === '') {
          // KeyframeTrack도 복사
          const clonedTrack = track.clone();
          tracks.push(clonedTrack);
        } else {
          console.warn(`애니메이션 트랙 스킵: ${track.name} (대상 객체 없음)`);
        }
      }
      
      if (tracks.length > 0) {
        const exportClip = new THREE.AnimationClip(clip.name, clip.duration, tracks);
        exportAnimations.push(exportClip);
        console.log(`애니메이션 "${clip.name}" 포함됨: ${tracks.length}/${clip.tracks.length} 트랙`);
      }
    }
  }
  
  // 내보내기 상태 확인
  let meshCount = 0;
  let boneCount = 0;
  let animationCount = exportAnimations.length;
  
  exportScene.traverse((obj) => {
    if (obj instanceof THREE.Mesh) meshCount++;
    if (obj.type === "Bone" || (obj instanceof THREE.Bone)) {
      boneCount++;
      // 한 번 더 확인하여 isBone 플래그 설정
      (obj as any).isBone = true;
    }
  });
  
  console.log(`내보내기 준비 완료:`);
  console.log(`- 메시: ${meshCount}개`);
  console.log(`- 본: ${boneCount}개`);
  console.log(`- 애니메이션: ${animationCount}개`);
  
  // GLTFExporter 옵션
  const exportOptions = {
    binary: true,
    animations: exportAnimations,
    includeCustomExtensions: true,    // VRM 등 커스텀 확장 포함
    onlyVisible: false,               // 숨겨진 객체도 포함
    truncateDrawRange: false,         // 드로우 범위 유지
    embedImages: true,                // 텍스처를 파일에 임베드
    forcePowerOfTwoTextures: false,   // 텍스처 크기 강제 변경 안 함
    maxTextureSize: 4096,             // 최대 텍스처 크기
    trs: false,                       // 변환을 분해하지 않고 매트릭스 그대로 사용
  };
  
  // GLB 내보내기 실행
  const exporter = new GLTFExporter();
  
  exporter.parse(
    exportScene, // 완전히 분리된 내보내기용 씬
    (buffer) => {
      const arrayBuffer = buffer as ArrayBuffer;
      const sizeMB = (arrayBuffer.byteLength / 1024 / 1024).toFixed(2);
      console.log(`✅ GLB 생성 성공: ${sizeMB}MB`);
      
      // 다운로드 실행
      const blob = new Blob([arrayBuffer], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    },
    (error) => {
      console.error("GLB 내보내기 실패:", error);
      alert("GLB 내보내기 실패: " + (error instanceof Error ? error.message : error));
    },
    exportOptions
  );
  */
  const exportableRoot = scene.children.find(obj => obj.name === 'exportableModel');
  if (!exportableRoot) {
    throw new Error('"exportableModel" 객체를 찾을 수 없습니다. 씬 루트에 존재해야 합니다.');
  }
  // 1단계: Bone 플래그 설정
  exportableRoot.traverse((child) => {
    if (child.type === 'Bone') {
      (child as any).isBone = true;
    }
  });
  // 2단계: SkinnedMesh 내부 skeleton.bones 확인 후 isBone 설정
  exportableRoot.traverse((child) => {
    if (child instanceof THREE.SkinnedMesh && child.skeleton?.bones) {
      for (const bone of child.skeleton.bones) {
        if (bone) (bone as any).isBone = true;
      }
    }
  });
  const exporter = new GLTFExporter();
  exporter.parse(
    exportableRoot,
    (buffer) => {
      const arrayBuffer = buffer as ArrayBuffer;
      const blob = new Blob([arrayBuffer], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    },
    (error) => {
      console.error("GLB 내보내기 실패:", error);
      alert("GLB 내보내기 실패: " + (error instanceof Error ? error.message : error));
    },
    {
      binary: true,
      animations: animations,
      includeCustomExtensions: true,
      onlyVisible: false,
      truncateDrawRange: false,
      embedImages: true,
      forcePowerOfTwoTextures: false,
      maxTextureSize: 4096,
      trs: false
    }
  );
}
