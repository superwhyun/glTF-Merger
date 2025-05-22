import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import type { VRM } from "@pixiv/three-vrm"

/**
 * 동적으로 VRM 애니메이션 라이브러리를 로드합니다.
 */
async function loadVRMAnimationPlugin() {
  try {
    const module = await import("@pixiv/three-vrm-animation")
    console.log("📦 VRM 애니메이션 모듈 로드됨:", module)
    console.log("사용 가능한 클래스/함수:", Object.keys(module))
    return module.VRMAnimationLoaderPlugin
  } catch (error) {
    console.error("VRM 애니메이션 라이브러리를 로드할 수 없습니다:", error)
    throw new Error("VRM 애니메이션 기능을 사용하려면 @pixiv/three-vrm-animation 라이브러리를 설치해주세요.")
  }
}

/**
 * VRMA 애니메이션 파일을 로드하고 VRM에 적용 가능한 AnimationClip을 생성합니다.
 */
export async function loadVRMAAnimation(file: File): Promise<any> {
  console.log("🎬 loadVRMAAnimation 시작:", file.name)
  
  return new Promise(async (resolve, reject) => {
    try {
      console.log("📦 VRM 애니메이션 플러그인 로드 시도...")
      const VRMAnimationLoaderPlugin = await loadVRMAnimationPlugin()
      console.log("✅ VRM 애니메이션 플러그인 로드 완료")
      
      const reader = new FileReader()
      
      reader.onload = async (event) => {
        try {
          console.log("📄 파일 읽기 완료, 파싱 시작...")
          
          if (!event.target?.result) {
            throw new Error("파일을 읽을 수 없습니다.")
          }

          // ArrayBuffer를 Blob으로 변환해서 URL 생성
          const arrayBuffer = event.target.result as ArrayBuffer
          console.log(`📊 파일 크기: ${arrayBuffer.byteLength} 바이트`)
          
          const blob = new Blob([arrayBuffer], { type: "application/octet-stream" })
          const url = URL.createObjectURL(blob)
          console.log("🔗 Blob URL 생성:", url)

          // GLTFLoader로 VRMA 파일 로드
          const loader = new GLTFLoader()
          console.log("🔧 GLTF 로더 플러그인 등록 중...")
          loader.register((parser: any) => new VRMAnimationLoaderPlugin(parser))
          console.log("✅ 플러그인 등록 완료")

          console.log("⏳ VRMA 파일 로드 시작...")
          loader.load(
            url,
            (gltf) => {
              console.log("🎉 GLTF 로드 성공!")
              console.log("GLTF 객체:", gltf)
              console.log("GLTF userData:", gltf.userData)
              
              // URL 정리
              URL.revokeObjectURL(url)

              // VRM 애니메이션 데이터 추출
              let vrmAnimation = gltf.userData.vrmAnimation || gltf.userData.vrmaAnimation || gltf.userData.vrmAnimations
              
              // vrmAnimations가 배열인 경우 첫 번째 애니메이션 선택
              if (Array.isArray(vrmAnimation) && vrmAnimation.length > 0) {
                console.log(`🎯 vrmAnimations 배열에서 ${vrmAnimation.length}개 애니메이션 발견, 첫 번째 선택`)
                vrmAnimation = vrmAnimation[0]
              }
              
              if (!vrmAnimation) {
                console.error("❌ VRM 애니메이션 데이터를 찾을 수 없습니다.")
                console.log("사용 가능한 userData 키:", Object.keys(gltf.userData))
                console.log("userData 내용:", gltf.userData)
                throw new Error("유효한 VRM 애니메이션을 찾을 수 없습니다.")
              }

              console.log("✅ VRM 애니메이션 로드 성공:", vrmAnimation)
              console.log("애니메이션 정보:", {
                name: vrmAnimation.name,
                duration: vrmAnimation.duration,
                tracks: vrmAnimation.tracks?.length || 0
              })
              resolve(vrmAnimation)
            },
            (progress) => {
              const percent = (progress.loaded / progress.total) * 100
              console.log(`⏳ VRMA 로딩 진행률: ${percent.toFixed(1)}%`)
            },
            (error) => {
              console.error("❌ VRMA 로딩 실패:", error)
              console.error("에러 세부사항:", error.message)
              URL.revokeObjectURL(url)
              reject(error)
            }
          )
        } catch (error) {
          console.error("❌ 파일 처리 중 오류:", error)
          reject(error)
        }
      }

      reader.onerror = () => {
        console.error("❌ 파일 읽기 실패")
        reject(new Error("파일 읽기 실패"))
      }

      console.log("📖 파일 읽기 시작...")
      reader.readAsArrayBuffer(file)
    } catch (error) {
      console.error("❌ loadVRMAAnimation 전체 오류:", error)
      reject(error)
    }
  })
}

/**
 * VRM 애니메이션을 VRM 모델에 적용 가능한 AnimationClip으로 변환합니다.
 */
export async function createAnimationClipFromVRMA(vrmAnimation: any, vrm: VRM): Promise<THREE.AnimationClip | null> {
  try {
    console.log("🔧 createAnimationClipFromVRMA 시작")
    console.log("vrmAnimation 객체:", vrmAnimation)
    
    if (!vrmAnimation) {
      console.error("❌ vrmAnimation이 null/undefined입니다.")
      return null
    }

    // 라이브러리 동적 로드
    const module = await import("@pixiv/three-vrm-animation")
    console.log("📦 VRM 애니메이션 모듈:", module)
    console.log("모듈 내용:", Object.keys(module))
    
    // 방법 1: createAnimationClip 스태틱 메서드 사용
    if (module.createAnimationClip && typeof module.createAnimationClip === 'function') {
      console.log("✅ createAnimationClip 함수 발견")
      try {
        const clip = module.createAnimationClip(vrmAnimation, vrm)
        if (clip) {
          console.log("✅ createAnimationClip으로 성공!")
          return clip
        }
      } catch (e) {
        console.log("createAnimationClip 실패:", e)
      }
    }
    
    // 방법 2: VRMAnimation 클래스 확인
    if (module.VRMAnimation) {
      console.log("VRMAnimation 클래스:", module.VRMAnimation)
      console.log("VRMAnimation 프로토타입:", Object.getOwnPropertyNames(module.VRMAnimation.prototype))
      
      // 인스턴스 메서드 확인
      if (vrmAnimation instanceof module.VRMAnimation) {
        console.log("✅ VRMAnimation 인스턴스 확인됨")
        
        // createAnimationClip 인스턴스 메서드
        if (typeof vrmAnimation.createAnimationClip === 'function') {
          console.log("✅ 인스턴스 createAnimationClip 메서드 발견")
          try {
            const clip = vrmAnimation.createAnimationClip(vrm)
            if (clip) {
              console.log("✅ 인스턴스 메서드로 성공!")
              return clip
            }
          } catch (e) {
            console.log("인스턴스 메서드 실패:", e)
          }
        }
        
        // toAnimationClip 인스턴스 메서드
        if (typeof vrmAnimation.toAnimationClip === 'function') {
          console.log("✅ 인스턴스 toAnimationClip 메서드 발견")
          try {
            const clip = vrmAnimation.toAnimationClip(vrm)
            if (clip) {
              console.log("✅ toAnimationClip 메서드로 성공!")
              return clip
            }
          } catch (e) {
            console.log("toAnimationClip 메서드 실패:", e)
          }
        }
      }
      
      // 스태틱 메서드 확인
      const staticMethods = Object.getOwnPropertyNames(module.VRMAnimation)
      console.log("VRMAnimation 스태틱 메서드들:", staticMethods)
      
      for (const methodName of staticMethods) {
        if (methodName.toLowerCase().includes('create') || methodName.toLowerCase().includes('clip')) {
          const method = module.VRMAnimation[methodName]
          if (typeof method === 'function') {
            console.log(`✅ 스태틱 메서드 ${methodName} 시도`)
            try {
              const clip = method(vrmAnimation, vrm)
              if (clip instanceof THREE.AnimationClip) {
                console.log(`✅ ${methodName}으로 성공!`)
                return clip
              }
            } catch (e) {
              console.log(`${methodName} 실패:`, e)
            }
          }
        }
      }
    }
    
    // 방법 3: 모든 export된 함수 확인
    for (const exportName in module) {
      const exportValue = module[exportName]
      if (typeof exportValue === 'function' && 
          (exportName.toLowerCase().includes('create') || 
           exportName.toLowerCase().includes('anim') || 
           exportName.toLowerCase().includes('clip'))) {
        console.log(`✅ export 함수 ${exportName} 시도`)
        try {
          let clip;
          // 클래스(생성자)인지 함수인지 판별
          if (
            typeof exportValue === "function" &&
            exportValue.prototype &&
            exportValue.prototype.constructor === exportValue
          ) {
            // 클래스면 new로 생성
            clip = new exportValue(vrmAnimation, vrm);
          } else {
            // 함수면 그냥 호출
            clip = exportValue(vrmAnimation, vrm);
          }
          if (clip instanceof THREE.AnimationClip) {
            console.log(`✅ ${exportName}으로 성공!`)
            return clip
          }
        } catch (e) {
          console.log(`${exportName} 실패:`, e)
        }
      }
    }

    // 방법 4: 더미 트랙으로 기본 AnimationClip 생성
    console.log("🔨 더미 AnimationClip 생성...")
    const duration = vrmAnimation.duration || 0
    
    if (duration > 0) {
      // 고유한 이름 생성 (타임스탬프 추가)
      const uniqueName = `VRMAAnimation_${Date.now()}`
      // 빈 트랙 배열로라도 기본 클립 생성
      const animationClip = new THREE.AnimationClip(uniqueName, duration, [])
      console.log(`✅ 더미 AnimationClip 생성: ${uniqueName}, ${duration}초`)
      return animationClip
    }

    console.error("❌ 모든 방법으로 AnimationClip 생성 실패")
    return null
  } catch (error) {
    console.error("❌ AnimationClip 생성 중 오류:", error)
    return null
  }
}

/**
 * VRM 모델이 VRM 애니메이션과 호환되는지 확인합니다.
 */
export function isVRMACompatible(vrm: VRM): boolean {
  // VRM 모델에 humanoid 데이터가 있는지 확인
  if (!vrm.humanoid) {
    console.warn("VRM 모델에 humanoid 데이터가 없습니다.")
    return false
  }

  // 기본적인 humanoid 본들이 있는지 확인
  const requiredBones = ["hips", "spine", "head", "leftUpperArm", "rightUpperArm", "leftUpperLeg", "rightUpperLeg"]
  const humanoidBones = vrm.humanoid.humanBones
  
  for (const boneName of requiredBones) {
    if (!humanoidBones[boneName]) {
      console.warn(`필수 본 '${boneName}'이 없습니다.`)
      return false
    }
  }

  return true
}

/**
 * VRM 애니메이션 정보를 가져옵니다.
 */
export function getVRMAInfo(vrmAnimation: any) {
  if (!vrmAnimation) return null

  return {
    name: vrmAnimation.name || "Unnamed Animation",
    duration: vrmAnimation.duration || 0,
    trackCount: vrmAnimation.tracks?.length || 0
  }
}
