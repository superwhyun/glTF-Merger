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
    
    // 방법 1: createVRMAnimationClip 함수 사용 (최신 API)
    if (module.createVRMAnimationClip && typeof module.createVRMAnimationClip === 'function') {
      console.log("✅ createVRMAnimationClip 함수 발견")
      try {
        const clip = module.createVRMAnimationClip(vrmAnimation, vrm)
        if (clip && clip instanceof THREE.AnimationClip) {
          console.log("✅ createVRMAnimationClip으로 성공!")
          console.log("생성된 클립:", { name: clip.name, duration: clip.duration, tracks: clip.tracks.length })
          return clip
        }
      } catch (e) {
        console.log("createVRMAnimationClip 실패:", e)
      }
    }
    
    // 방법 2: createAnimationClip 스태틱 메서드 사용
    if (module.createAnimationClip && typeof module.createAnimationClip === 'function') {
      console.log("✅ createAnimationClip 함수 발견")
      try {
        const clip = module.createAnimationClip(vrmAnimation, vrm)
        if (clip && clip instanceof THREE.AnimationClip) {
          console.log("✅ createAnimationClip으로 성공!")
          console.log("생성된 클립:", { name: clip.name, duration: clip.duration, tracks: clip.tracks.length })
          return clip
        }
      } catch (e) {
        console.log("createAnimationClip 실패:", e)
      }
    }
    
    // 방법 3: VRMAnimation 클래스 확인
    if (module.VRMAnimation && vrmAnimation instanceof module.VRMAnimation) {
      console.log("✅ VRMAnimation 인스턴스 확인됨")
      
      // createAnimationClip 인스턴스 메서드
      if (typeof vrmAnimation.createAnimationClip === 'function') {
        console.log("✅ 인스턴스 createAnimationClip 메서드 발견")
        try {
          const clip = vrmAnimation.createAnimationClip(vrm)
          if (clip && clip instanceof THREE.AnimationClip) {
            console.log("✅ 인스턴스 메서드로 성공!")
            console.log("생성된 클립:", { name: clip.name, duration: clip.duration, tracks: clip.tracks.length })
            return clip
          }
        } catch (e) {
          console.log("인스턴스 메서드 실패:", e)
        }
      }
    }

    // 방법 4: 원본 GLTF 애니메이션을 VRM에 맞게 리맵핑
    console.log("🔄 GLTF 애니메이션 데이터 직접 처리 시도...")
    
    // vrmAnimation에서 실제 GLTF AnimationClip 추출
    let sourceClip: THREE.AnimationClip | null = null;
    
    // vrmAnimation 객체에서 tracks나 애니메이션 데이터 찾기
    if (vrmAnimation.tracks && Array.isArray(vrmAnimation.tracks)) {
      console.log("✅ vrmAnimation.tracks 발견:", vrmAnimation.tracks.length)
      sourceClip = new THREE.AnimationClip(
        vrmAnimation.name || `VRMAAnimation_${Date.now()}`,
        vrmAnimation.duration || -1,
        vrmAnimation.tracks
      )
    } else if (vrmAnimation.clip && vrmAnimation.clip instanceof THREE.AnimationClip) {
      console.log("✅ vrmAnimation.clip 발견")
      sourceClip = vrmAnimation.clip
    } else if (vrmAnimation instanceof THREE.AnimationClip) {
      console.log("✅ vrmAnimation이 직접 AnimationClip")
      sourceClip = vrmAnimation
    }
    
    if (sourceClip && sourceClip.tracks.length > 0) {
      console.log("✅ 소스 클립 발견:", {
        name: sourceClip.name,
        duration: sourceClip.duration,
        tracks: sourceClip.tracks.length
      })
      
      // VRM의 humanoid 본 매핑 정보 가져오기
      const humanoidBones = vrm.humanoid?.humanBones
      if (!humanoidBones) {
        console.warn("❌ VRM humanoid 정보가 없습니다")
        return sourceClip // 그래도 원본 클립 반환
      }
      
      // 트랙 리맵핑: VRMA 본 이름을 VRM 본 이름으로 변환
      const remappedTracks: THREE.KeyframeTrack[] = []
      
      for (const track of sourceClip.tracks) {
        console.log("🔍 트랙 처리:", track.name)
        
        // 트랙 이름에서 본 이름 추출 (예: "mixamorig:Hips.position" -> "Hips")
        const boneName = extractBoneNameFromTrack(track.name)
        console.log("추출된 본 이름:", boneName)
        
        // humanoid 매핑에서 해당하는 VRM 본 찾기
        const vrmBone = findVRMBoneByName(humanoidBones, boneName)
        
        if (vrmBone) {
          // 새로운 트랙 이름으로 변경
          const property = track.name.split('.').pop() // "position", "quaternion", "scale"
          const newTrackName = `${vrmBone.node.name}.${property}`
          
          console.log(`✅ 본 매핑: ${boneName} -> ${vrmBone.node.name}`)
          
          // 새로운 트랙 생성
          const RemappedTrack = track.clone()
          RemappedTrack.name = newTrackName
          remappedTracks.push(RemappedTrack)
        } else {
          console.log(`❌ 매핑되지 않은 본: ${boneName}`)
        }
      }
      
      if (remappedTracks.length > 0) {
        const remappedClip = new THREE.AnimationClip(
          sourceClip.name + "_VRM",
          sourceClip.duration,
          remappedTracks
        )
        console.log("✅ VRM 리맵핑 클립 생성 완료:", {
          name: remappedClip.name,
          duration: remappedClip.duration,
          tracks: remappedClip.tracks.length
        })
        return remappedClip
      }
      
      // 리맵핑 실패시 원본 클립 반환
      console.log("⚠️ 리맵핑 실패, 원본 클립 반환")
      return sourceClip
    }

    console.error("❌ 유효한 애니메이션 데이터를 찾을 수 없습니다")
    return null
  } catch (error) {
    console.error("❌ AnimationClip 생성 중 오류:", error)
    return null
  }
}

// 헬퍼 함수: 트랙 이름에서 본 이름 추출
function extractBoneNameFromTrack(trackName: string): string {
  // 예시: "mixamorig:Hips.position" -> "Hips"
  // 예시: "Armature|mixamorig:Spine.quaternion" -> "Spine"
  const parts = trackName.split(/[.:]/)
  if (parts.length >= 2) {
    const bonePart = parts[parts.length - 2] // 마지막에서 두 번째 부분
    return bonePart.replace(/^mixamorig:?/, '').trim()
  }
  return trackName.split('.')[0] // 기본 fallback
}

// 헬퍼 함수: humanoid 매핑에서 본 이름으로 VRM 본 찾기
function findVRMBoneByName(humanoidBones: any, boneName: string): any {
  // 정확한 매핑 테이블
  const boneMapping: { [key: string]: string } = {
    'Hips': 'hips',
    'Spine': 'spine',
    'Spine1': 'chest',
    'Spine2': 'upperChest',
    'Neck': 'neck',
    'Head': 'head',
    'LeftShoulder': 'leftShoulder',
    'LeftArm': 'leftUpperArm',
    'LeftForeArm': 'leftLowerArm',
    'LeftHand': 'leftHand',
    'RightShoulder': 'rightShoulder',
    'RightArm': 'rightUpperArm',
    'RightForeArm': 'rightLowerArm',
    'RightHand': 'rightHand',
    'LeftUpLeg': 'leftUpperLeg',
    'LeftLeg': 'leftLowerLeg',
    'LeftFoot': 'leftFoot',
    'RightUpLeg': 'rightUpperLeg',
    'RightLeg': 'rightLowerLeg',
    'RightFoot': 'rightFoot'
  }
  
  const humanoidName = boneMapping[boneName] || boneName.toLowerCase()
  return humanoidBones[humanoidName] || null
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
