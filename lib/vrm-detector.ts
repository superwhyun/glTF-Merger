import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import { VRMLoaderPlugin, VRM } from "@pixiv/three-vrm"

/**
 * VRM 감지 결과 인터페이스
 */
export interface VRMDetectionResult {
  isVRM: boolean
  vrm: VRM | null
  vrmMetadata: any | null
  rawExtensions: any | null
}

/**
 * Three.js를 사용하여 VRM 파일을 감지하고 메타데이터를 추출합니다.
 * 이 함수는 파일의 VRM 여부만 확인하며, 실제 렌더링은 하지 않습니다.
 */
export async function detectVRMWithThreeJS(file: File): Promise<VRMDetectionResult> {
  console.log(`🔍 [VRM 감지] Three.js로 VRM 감지 시작: ${file.name}`)
  
  // 임시 GLTFLoader 생성 (감지 전용)
  const loader = new GLTFLoader()
  loader.register((parser) => {
    console.log('🔧 [VRM 감지] VRMLoaderPlugin 등록')
    return new VRMLoaderPlugin(parser)
  })
  
  // 파일을 Blob URL로 변환
  const url = URL.createObjectURL(file)
  
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      async (gltf) => {
        try {
          console.log('✅ [VRM 감지] GLTF 로드 완료')
          
          // VRM 데이터 확인
          const vrm = gltf.userData?.vrm as VRM | null
          const isVRM = !!vrm
          
          let vrmMetadata = null
          let rawExtensions = null
          
          if (vrm) {
            console.log('✅ [VRM 감지] VRM 데이터 발견')
            
            // VRM 메타데이터 추출
            vrmMetadata = {
              title: vrm.meta?.title || '제목 없음',
              author: vrm.meta?.author || '작성자 불명',
              version: vrm.meta?.version || '버전 불명',
              description: vrm.meta?.description || '',
              licenseUrl: vrm.meta?.licenseUrl || '',
              contactInfo: vrm.meta?.contactInfo || '',
              reference: vrm.meta?.reference || '',
              thumbnailImage: vrm.meta?.thumbnailImage || null,
            }
            
            // 원시 확장 데이터 추출 (GLB에서 직접)
            rawExtensions = await extractRawVRMExtensions(file)
            
            console.log('✅ [VRM 감지] VRM 메타데이터:', vrmMetadata)
          } else {
            console.log('ℹ️ [VRM 감지] 일반 GLB 파일')
          }
          
          // URL 정리
          URL.revokeObjectURL(url)
          
          resolve({
            isVRM,
            vrm,
            vrmMetadata,
            rawExtensions
          })
        } catch (error) {
          console.error('❌ [VRM 감지] 처리 중 오류:', error)
          URL.revokeObjectURL(url)
          reject(error)
        }
      },
      (progress) => {
        console.log(`🔄 [VRM 감지] 로딩 진행률: ${(progress.loaded / progress.total * 100).toFixed(1)}%`)
      },
      (error) => {
        console.error('❌ [VRM 감지] GLTF 로드 실패:', error)
        URL.revokeObjectURL(url)
        reject(error)
      }
    )
  })
}

/**
 * GLB 파일에서 원시 VRM 확장 데이터를 직접 추출합니다.
 */
async function extractRawVRMExtensions(file: File): Promise<any> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    
    // GLB 헤더 확인
    const headerView = new DataView(arrayBuffer, 0, 12)
    const magic = headerView.getUint32(0, true)
    
    if (magic !== 0x46546C67) {
      console.warn('❌ [원시 VRM 추출] GLB 파일이 아님')
      return null
    }
    
    // JSON 청크 파싱
    const chunkView = new DataView(arrayBuffer, 12, 8)
    const chunkLength = chunkView.getUint32(0, true)
    const chunkType = chunkView.getUint32(4, true)
    
    if (chunkType !== 0x4E4F534A) {
      console.warn('❌ [원시 VRM 추출] JSON 청크를 찾을 수 없음')
      return null
    }
    
    // JSON 데이터 추출
    const jsonData = arrayBuffer.slice(20, 20 + chunkLength)
    const decoder = new TextDecoder('utf-8')
    const jsonString = decoder.decode(jsonData)
    const gltf = JSON.parse(jsonString)
    
    // VRM 확장 데이터 반환
    const vrmExtension = gltf.extensions?.VRM
    if (vrmExtension) {
      console.log('✅ [원시 VRM 추출] VRM 확장 데이터 추출 완료')
      return vrmExtension
    } else {
      console.log('ℹ️ [원시 VRM 추출] VRM 확장 없음')
      return null
    }
  } catch (error) {
    console.error('❌ [원시 VRM 추출] 오류:', error)
    return null
  }
}

/**
 * VRM 감지 결과를 기반으로 사용자 친화적 메시지를 생성합니다.
 */
export function getVRMDetectionMessage(result: VRMDetectionResult): string {
  if (!result.isVRM) {
    return "일반 GLB 모델 파일"
  }
  
  const title = result.vrmMetadata?.title || "제목 없음"
  const author = result.vrmMetadata?.author || "작성자 불명"
  
  return `VRM 모델: ${title} (by ${author})`
}
