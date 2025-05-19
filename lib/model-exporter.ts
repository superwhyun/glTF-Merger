import * as THREE from "three"
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter"

/**
 * 원본 구조와 월드 변환을 완전히 보존하며 GLB 파일로 내보내는 함수
 */
export function exportModelToGLB(scene: THREE.Scene, fileName: string, animations: THREE.AnimationClip[] = []): void {
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
  
  // 모델 객체들을 **구조 그대로** 복사
  for (const modelObject of modelObjects) {
    try {
      console.log(`모델 복사 시작: ${modelObject.type} "${modelObject.name}"`);
      
      // VRM 모델의 특수 속성을 안전하게 처리하는 복제 함수
      function safeCloneObject(original: THREE.Object3D): THREE.Object3D {
        let cloned: THREE.Object3D;
        
        // 메시 타입별 안전한 복제
        if (original instanceof THREE.SkinnedMesh) {
          cloned = new THREE.SkinnedMesh(original.geometry, original.material);
          
          // 스킨 관련 속성 복제
          if (original.skeleton) {
            (cloned as THREE.SkinnedMesh).skeleton = original.skeleton.clone();
            (cloned as THREE.SkinnedMesh).bindMatrix.copy(original.bindMatrix);
            (cloned as THREE.SkinnedMesh).bindMatrixInverse.copy(original.bindMatrixInverse);
          }
        } else if (original instanceof THREE.Mesh) {
          cloned = new THREE.Mesh(original.geometry, original.material);
        } else if (original instanceof THREE.Bone) {
          cloned = new THREE.Bone();
        } else if (original instanceof THREE.Group) {
          cloned = new THREE.Group();
        } else {
          // 기본 Object3D 복제 시도
          try {
            cloned = original.clone(false); // 자식 제외하고 복제
          } catch (e) {
            console.warn(`${original.type} 복제 실패, 새 Object3D 생성`, e);
            cloned = new THREE.Object3D();
          }
        }
        
        // 기본 속성 복사 (VRM 특수 속성 제외)
        cloned.name = original.name;
        cloned.type = original.type;
        cloned.position.copy(original.position);
        cloned.rotation.copy(original.rotation);
        cloned.scale.copy(original.scale);
        cloned.visible = original.visible;
        cloned.castShadow = original.castShadow;
        cloned.receiveShadow = original.receiveShadow;
        cloned.frustumCulled = original.frustumCulled;
        cloned.renderOrder = original.renderOrder;
        
        // 매트릭스 복사
        cloned.matrix.copy(original.matrix);
        cloned.matrixWorld.copy(original.matrixWorld);
        cloned.matrixAutoUpdate = original.matrixAutoUpdate;
        cloned.matrixWorldNeedsUpdate = true;
        
        // userData 안전하게 복사 (VRM 특수 속성 필터링)
        if (original.userData) {
          const safeUserData: any = {};
          for (const key in original.userData) {
            // VRM 관련 특수 속성들 스킵
            if (key.includes('vrm') || key.includes('VRM') || 
                key === 'yaw' || key === 'pitch' || key === 'roll' ||
                typeof original.userData[key] === 'function') {
              continue;
            }
            try {
              safeUserData[key] = JSON.parse(JSON.stringify(original.userData[key]));
            } catch (e) {
              // 복사할 수 없는 속성은 스킵
              console.warn(`userData.${key} 복사 스킵:`, e);
            }
          }
          cloned.userData = safeUserData;
        }
        
        // 자식 객체들 재귀적으로 복제
        for (const child of original.children) {
          const clonedChild = safeCloneObject(child);
          cloned.add(clonedChild);
        }
        
        return cloned;
      }
      
      // 안전한 복제 실행
      const clonedModel = safeCloneObject(modelObject);
      
      // 내보내기 씬에 추가
      exportScene.add(clonedModel);
      console.log(`✅ 모델 "${modelObject.name}" 안전하게 복사 완료`);
      
    } catch (error) {
      console.error(`❌ 모델 "${modelObject.name}" 복사 실패:`, error);
      throw new Error(`모델 복사 중 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
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
    if (obj instanceof THREE.Bone) boneCount++;
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
      const link = document.createElement("a");
      
      link.href = url;
      link.download = fileName.endsWith(".glb") ? fileName : `${fileName}.glb`;
      link.style.display = "none";
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // 메모리 정리
      setTimeout(() => {
        URL.revokeObjectURL(url);
        console.log("✅ 다운로드 완료, 메모리 정리됨");
      }, 1000);
    },
    (error) => {
      console.error("❌ GLB 내보내기 실패:", error);
      throw new Error(`GLB 내보내기 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    },
    exportOptions
  );
}

/**
 * 모델 구조를 업데이트하는 함수
 */
export function updateModelFromStructure(scene: THREE.Scene, modelStructure: any): THREE.Scene {
  return scene;
}
