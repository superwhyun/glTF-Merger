import * as THREE from "three"
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader"
import { remapAnimationTracksToModelBones } from "@/lib/animation-utils"


/**
 * FBX 애니메이션 파일을 로드하고 AnimationClip을 생성합니다.
 */
export async function loadFBXAnimation(file: File, targetModel?: any): Promise<THREE.AnimationClip[]> {
  console.log("🎬 loadFBXAnimation 시작:", file.name)
  
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader()
      
      reader.onload = async (event) => {
        try {
          console.log("📄 FBX 파일 읽기 완료, 파싱 시작...")
          
          if (!event.target?.result) {
            throw new Error("FBX 파일을 읽을 수 없습니다.")
          }

          // ArrayBuffer를 Blob으로 변환해서 URL 생성
          const arrayBuffer = event.target.result as ArrayBuffer
          console.log(`📊 FBX 파일 크기: ${arrayBuffer.byteLength} 바이트`)
          
          const blob = new Blob([arrayBuffer], { type: "application/octet-stream" })
          const url = URL.createObjectURL(blob)
          console.log("🔗 Blob URL 생성:", url)

          // FBXLoader로 FBX 파일 로드
          const loader = new FBXLoader()
          console.log("⏳ FBX 파일 로드 시작...")
          
          loader.load(
            url,
            (fbx) => {
              console.log("🎉 FBX 로드 성공!")
              console.log("FBX 객체:", fbx)
              
              // URL 정리
              URL.revokeObjectURL(url)

              // FBX에서 애니메이션 추출
              const animations = fbx.animations || []
              
              if (animations.length === 0) {
                console.warn("❌ FBX 파일에 애니메이션이 없습니다.")
                resolve([])
                return
              }

              console.log(`✅ FBX 애니메이션 ${animations.length}개 발견`)
              animations.forEach((anim, index) => {
                console.log(`  - 애니메이션 ${index}: ${anim.name}, 지속시간: ${anim.duration}, 트랙: ${anim.tracks.length}`)
                
                // 트랙 이름과 데이터 상세 로그
                anim.tracks.forEach((track, trackIndex) => {
                  if (trackIndex < 3) { // 처음 3개 트랙만 상세 로그
                    console.log(`    트랙 ${trackIndex}:`, {
                      name: track.name,
                      type: track.constructor.name,
                      times: track.times?.length || 0,
                      values: track.values?.length || 0,
                      duration: track.times ? track.times[track.times.length - 1] : 0,
                      firstValue: track.values ? track.values.slice(0, 4) : []
                    })
                  }
                })
              })

              
              // 타겟 모델이 있는 경우 본 이름 리맵핑 수행
              if (targetModel) {
                console.log("🔄 FBX 애니메이션 본 이름 리맵핑 시작...")
                animations.forEach(clip => {
                  remapAnimationTracksToModelBones(clip, targetModel)
                })
                console.log("✅ FBX 애니메이션 본 이름 리맵핑 완료")
              }
              
              console.log(`아따 씨발 여기여`);
              // Print bone name prefix of the first track of each animation clip
              animations.forEach(anim => {
                if (anim.tracks && anim.tracks.length > 0) {
                  const firstTrack = anim.tracks[0];
                  const firstTrackName = firstTrack.name || '';
                  const firstBoneName = firstTrackName.split('.')[0];
                  console.log(`[FBX clip bone]`, anim.name || '(no clip name)', '-', firstBoneName);
                }
              });
              resolve(animations)
            },
            (progress) => {
              const percent = (progress.loaded / progress.total) * 100
              console.log(`⏳ FBX 로딩 진행률: ${percent.toFixed(1)}%`)
            },
            (error) => {
              console.error("❌ FBX 로딩 실패:", error)
              URL.revokeObjectURL(url)
              reject(error)
            }
          )
        } catch (error) {
          console.error("❌ FBX 파일 처리 중 오류:", error)
          reject(error)
        }
      }

      reader.onerror = () => {
        console.error("❌ FBX 파일 읽기 실패")
        reject(new Error("FBX 파일 읽기 실패"))
      }

      console.log("📖 FBX 파일 읽기 시작...")
      reader.readAsArrayBuffer(file)
    } catch (error) {
      console.error("❌ loadFBXAnimation 전체 오류:", error)
      reject(error)
    }
  })
}