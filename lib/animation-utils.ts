import * as THREE from "three"
import { loadVRMAAnimation, createAnimationClipFromVRMA } from "@/lib/vrma-utils"
import { loadFBXAnimation } from "@/lib/fbx-animation-utils"
import { remapAnimationTracks } from "@/lib/bone-mapping-utils"
import type { VRM } from "@pixiv/three-vrm"

/**
 * 파일 확장자에 따라 적절한 애니메이션 로더를 사용하여 애니메이션을 로드합니다.
 */
export async function loadAnimation(file: File, targetModel?: VRM | THREE.Object3D): Promise<THREE.AnimationClip[]> {
  const extension = file.name.split(".").pop()?.toLowerCase()
  console.log(`🎬 애니메이션 로드 시작: ${file.name} (.${extension})`)
  
  let animationClips: THREE.AnimationClip[] = []
  
  switch (extension) {
    case "vrma":
    case "glb":
      // VRMA 애니메이션인 경우
      if (targetModel && isVRM(targetModel)) {
        console.log("🔄 VRMA 애니메이션 처리 (VRM 모델용)")
        const vrmaAnimation = await loadVRMAAnimation(file)
        if (vrmaAnimation) {
          const clip = await createAnimationClipFromVRMA(vrmaAnimation, targetModel)
          animationClips = clip ? [clip] : []
        }
      } else {
        // GLB 애니메이션인 경우 (일반 모델용)
        console.log("🔄 GLB 애니메이션 처리 (일반 모델용)")
        animationClips = await loadGLBAnimation(file)
      }
      break
      
    case "fbx":
      console.log("🔄 FBX 애니메이션 처리")
      animationClips = await loadFBXAnimation(file, targetModel)
      break
      
    case "gltf":
      console.log("🔄 GLTF 애니메이션 처리")
      animationClips = await loadGLTFAnimation(file)
      break
      
    default:
      throw new Error(`지원하지 않는 애니메이션 파일 형식: .${extension}`)
  }
  

  
  return animationClips
}

/**
 * VRM 객체인지 확인하는 헬퍼 함수
 */
function isVRM(obj: any): obj is VRM {
  return obj && typeof obj.humanoid !== 'undefined'
}

/**
 * GLB 파일에서 애니메이션 로드
 */
async function loadGLBAnimation(file: File): Promise<THREE.AnimationClip[]> {
  return new Promise((resolve, reject) => {
    const { GLTFLoader } = require("three/examples/jsm/loaders/GLTFLoader")
    const reader = new FileReader()
    
    reader.onload = (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer
        const blob = new Blob([arrayBuffer], { type: "application/octet-stream" })
        const url = URL.createObjectURL(blob)
        
        const loader = new GLTFLoader()
        loader.load(
          url,
          (gltf) => {
            URL.revokeObjectURL(url)
            console.log(`GLB 애니메이션 ${gltf.animations.length}개 로드됨`)
            resolve(gltf.animations || [])
          },
          undefined,
          (error) => {
            URL.revokeObjectURL(url)
            reject(error)
          }
        )
      } catch (error) {
        reject(error)
      }
    }
    
    reader.onerror = () => reject(new Error("GLB 파일 읽기 실패"))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * GLTF 파일에서 애니메이션 로드
 */
async function loadGLTFAnimation(file: File): Promise<THREE.AnimationClip[]> {
  return new Promise((resolve, reject) => {
    const { GLTFLoader } = require("three/examples/jsm/loaders/GLTFLoader")
    const reader = new FileReader()
    
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string
        const gltfData = JSON.parse(text)
        
        const loader = new GLTFLoader()
        loader.parse(
          gltfData,
          '',
          (gltf) => {
            console.log(`GLTF 애니메이션 ${gltf.animations.length}개 로드됨`)
            resolve(gltf.animations || [])
          },
          (error) => {
            reject(error)
          }
        )
      } catch (error) {
        reject(error)
      }
    }
    
    reader.onerror = () => reject(new Error("GLTF 파일 읽기 실패"))
    reader.readAsText(file)
  })
}


// Helper: Remap animation tracks to match model bone names
/**
 * Remaps animation track names in the animationClip to match the actual bone names in the modelScene.
 * If a track's bone prefix matches the start of any model bone name, and the model bone name is longer,
 * replace the track's bone name part with the model bone name.
 * Prints a single-line console log for each change: [track remap] before → after
 * 
 * @param {THREE.AnimationClip} animationClip
 * @param {THREE.Object3D} modelScene
 */
export function remapAnimationTracksToModelBones(animationClip: any, modelScene: any) {
  if (!animationClip || !modelScene) return;
  // Collect all bone names from the model's scene
  const boneNames: string[] = [];
  modelScene.traverse((obj: any) => {
    if (obj.isBone) {
      boneNames.push(obj.name);
    }
  });
  // Sort bone names by length descending, so longer names are matched first
  boneNames.sort((a, b) => b.length - a.length);
  // Remap each track
  for (const track of animationClip.tracks) {
    // track.name is like 'Hips.position' or 'mixamorig:Hips.position'
    const dotIdx = track.name.indexOf(".");
    if (dotIdx === -1) continue;
    const trackPrefix = track.name.slice(0, dotIdx);
    const suffix = track.name.slice(dotIdx); // includes dot
    // Try to find a bone name that starts with trackPrefix and is longer
    const matched = boneNames.find(boneName => boneName.startsWith(trackPrefix) && boneName.length > trackPrefix.length);
    if (matched) {
      const newTrackName = matched + suffix;
      if (newTrackName !== track.name) {
        console.log(`[track remap] ${track.name} → ${newTrackName}`);
        track.name = newTrackName;
      }
    }
    else {
      console.log(trackPrefix, '못찾음. 씨바꺼');
    }
  }
}

// %%%%%LAST%%%%%